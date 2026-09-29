use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

#[cfg(target_os = "macos")]
use tauri_nspanel::objc2_app_kit::NSWindowAnimationBehavior;
#[cfg(target_os = "macos")]
use tauri_nspanel::{CollectionBehavior, ManagerExt, PanelLevel, StyleMask, WebviewWindowExt};

// macOS panel subclass used for the capture overlay, floating above the menu bar.
#[cfg(target_os = "macos")]
tauri_nspanel::tauri_panel! {
    panel!(CapturePanel {
        config: {
            is_floating_panel: true,
            can_become_key_window: true,
            can_become_main_window: false
        }
    })
}

/// Holds the path of the frozen screenshot shown by the selection overlay.
#[derive(Default)]
pub struct CaptureState(pub Mutex<Option<String>>);

/// On-screen window bounds (physical px) captured alongside the frozen frame,
/// used to highlight the window under the cursor before a region is selected.
#[derive(Default)]
pub struct WindowsState(pub Mutex<Vec<crate::window_list::WindowRect>>);

fn remove_capture_file(state: &CaptureState) {
    if let Ok(mut guard) = state.0.lock() {
        if let Some(path) = guard.take() {
            let _ = std::fs::remove_file(path);
        }
    }
}

/// Close any existing capture overlay. Must run on the main thread.
#[cfg(target_os = "macos")]
fn unmount_capture(app: &AppHandle) {
    if let Ok(panel) = app.get_webview_panel("capture") {
        if let Some(window) = panel.to_window() {
            let _ = window.close();
        }
        return;
    }
    if let Some(window) = app.get_webview_window("capture") {
        let _ = window.close();
    }
}

#[cfg(not(target_os = "macos"))]
fn unmount_capture(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("capture") {
        let _ = window.close();
    }
}

/// Capture the primary display, hide the launcher and open the (hidden)
/// selection overlay. The overlay loads the frozen frame from `capture_frame_bytes`
/// and shows itself once the image is ready.
#[tauri::command(async)]
pub async fn start_capture(
    app: AppHandle,
    state: tauri::State<'_, CaptureState>,
    windows_state: tauri::State<'_, WindowsState>,
) -> Result<(), String> {
    remove_capture_file(&state);

    let show_main = |app: &AppHandle| {
        if let Some(main) = app.get_webview_window("main") {
            let _ = main.show();
            let _ = main.set_focus();
        }
    };

    if let Some(main) = app.get_webview_window("main") {
        let _ = main.hide();
    }

    // A tiny pause lets the compositor drop the launcher, then capture on a
    // blocking thread so the main/UI thread stays responsive.
    let captured = tauri::async_runtime::spawn_blocking(|| {
        std::thread::sleep(Duration::from_millis(80));
        crate::platform::capture_primary_display_to_file()
    })
    .await
    .map_err(|error| error.to_string())?;

    let path = match captured {
        Ok(path) => path,
        Err(error) => {
            show_main(&app);
            return Err(error);
        }
    };

    let monitor = match app.primary_monitor() {
        Ok(Some(monitor)) => monitor,
        Ok(None) => {
            show_main(&app);
            return Err("未找到显示器".to_string());
        }
        Err(error) => {
            show_main(&app);
            return Err(error.to_string());
        }
    };
    let scale = monitor.scale_factor();
    let position = monitor.position().to_logical::<f64>(scale);
    let size = monitor.size().to_logical::<f64>(scale);

    // Collect on-screen window bounds (points -> physical px, clamped to this
    // display) so the overlay can highlight the window under the cursor.
    let physical = monitor.size();
    let frame_width = physical.width as f64;
    let frame_height = physical.height as f64;
    let windows: Vec<crate::window_list::WindowRect> = crate::window_list::list_windows()
        .into_iter()
        .filter_map(|window| {
            let left = (window.x * scale).max(0.0);
            let top = (window.y * scale).max(0.0);
            let right = ((window.x + window.width) * scale).min(frame_width);
            let bottom = ((window.y + window.height) * scale).min(frame_height);
            if right - left < 4.0 || bottom - top < 4.0 {
                return None;
            }
            Some(crate::window_list::WindowRect {
                x: left,
                y: top,
                width: right - left,
                height: bottom - top,
            })
        })
        .collect();
    if let Ok(mut guard) = windows_state.0.lock() {
        *guard = windows;
    }

    // Clean up any previous overlay (restoring the panel class first on macOS).
    {
        let handle = app.clone();
        let (tx, rx) = std::sync::mpsc::channel();
        app.run_on_main_thread(move || {
            unmount_capture(&handle);
            let _ = tx.send(());
        })
        .map_err(|error| error.to_string())?;
        let _ = rx.recv();
    }

    if let Ok(mut guard) = state.0.lock() {
        *guard = Some(path);
    }

    let window =
        match WebviewWindowBuilder::new(&app, "capture", WebviewUrl::App("capture.html".into()))
            .title("h-hub capture")
            .decorations(false)
            .transparent(true)
            .shadow(false)
            .resizable(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .accept_first_mouse(true)
            .disable_drag_drop_handler()
            .visible(false)
            .position(position.x, position.y)
            .inner_size(size.width, size.height)
            .build()
        {
            Ok(window) => window,
            Err(error) => {
                show_main(&app);
                return Err(error.to_string());
            }
        };

    #[cfg(target_os = "macos")]
    if let Err(error) = configure_capture_panel(&app, &window) {
        let _ = window.close();
        show_main(&app);
        return Err(error);
    }

    Ok(())
}

/// Convert the capture window into an NSPanel and raise it above the menu bar.
/// Must run on the main thread (AppKit requirement).
#[cfg(target_os = "macos")]
fn configure_capture_panel(app: &AppHandle, window: &tauri::WebviewWindow) -> Result<(), String> {
    let window = window.clone();
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let result = (|| -> Result<(), String> {
            let panel = window
                .to_panel::<CapturePanel>()
                .map_err(|e| e.to_string())?;
            panel.set_level(PanelLevel::Status.value());
            // Disable AppKit's automatic orderFront animation (utility/panel
            // windows otherwise pop/scale in, which reads as the frozen frame
            // shifting or zooming when the overlay appears).
            panel.as_panel().setAnimationBehavior(NSWindowAnimationBehavior::None);
            panel.set_collection_behavior(
                CollectionBehavior::new()
                    .stationary()
                    .can_join_all_spaces()
                    .full_screen_auxiliary()
                    .into(),
            );
            let _ = panel.add_style_mask(StyleMask::empty().nonactivating_panel().into());
            Ok(())
        })();
        let _ = tx.send(result);
    })
    .map_err(|error| error.to_string())?;
    rx.recv().map_err(|error| error.to_string())?
}

/// Raw PNG bytes of the frozen frame, delivered as an ArrayBuffer (no base64).
/// The overlay turns it into a blob URL so the canvas stays untainted and
/// `toBlob` / `toDataURL` keep working.
#[tauri::command]
pub fn capture_frame_bytes(
    state: tauri::State<CaptureState>,
) -> Result<tauri::ipc::Response, String> {
    let guard = state.0.lock().map_err(|error| error.to_string())?;
    let path = guard.as_ref().ok_or_else(|| "没有可用的截图".to_string())?;
    let bytes = std::fs::read(path).map_err(|error| error.to_string())?;
    Ok(tauri::ipc::Response::new(bytes))
}

/// Window bounds (physical px) captured alongside the frozen frame.
#[tauri::command]
pub fn capture_windows(state: tauri::State<WindowsState>) -> Vec<crate::window_list::WindowRect> {
    state
        .0
        .lock()
        .map(|guard| guard.clone())
        .unwrap_or_default()
}

/// Show the overlay once its frame is decoded. On macOS this also activates the
/// app and makes the panel key so the very first mouse-down starts a selection
/// instead of being swallowed while focusing the window.
#[tauri::command]
pub fn reveal_capture(app: AppHandle) {
    #[cfg(target_os = "macos")]
    if let Ok(panel) = app.get_webview_panel("capture") {
        panel.set_collection_behavior(
            CollectionBehavior::new()
                .stationary()
                .can_join_all_spaces()
                .full_screen_auxiliary()
                .into(),
        );
        activate_application();
        panel.show_and_make_key();
        panel.make_key_window();
        return;
    }

    if let Some(window) = app.get_webview_window("capture") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

/// Bring the app to the foreground so the overlay receives the first click.
#[cfg(target_os = "macos")]
#[allow(deprecated)]
fn activate_application() {
    use tauri_nspanel::objc2_app_kit::NSApplication;
    use tauri_nspanel::objc2_foundation::MainThreadMarker;

    if let Some(mtm) = MainThreadMarker::new() {
        NSApplication::sharedApplication(mtm).activateIgnoringOtherApps(true);
    }
}

/// Close the selection overlay and delete the temporary screenshot.
#[tauri::command]
pub fn dispose_capture(app: AppHandle, state: tauri::State<CaptureState>) {
    remove_capture_file(&state);
    unmount_capture(&app);
}
