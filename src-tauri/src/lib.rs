mod capture;
mod commands;
mod export;
mod model;
mod pin;
mod platform;
mod window_list;

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager,
};

fn show_main(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn build_tray(app: &tauri::App) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "显示 h-hub", true, None::<&str>)?;
    let theme = MenuItem::with_id(app, "theme", "切换浅色 / 深色", true, None::<&str>)?;
    let autostart = MenuItem::with_id(app, "autostart", "切换开机自启", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&show, &theme, &autostart, &quit])?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("h-hub")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => show_main(app),
            "theme" => {
                let _ = app.emit("hhub://toggle-theme", ());
            }
            "autostart" => {
                let _ = app.emit("hhub://toggle-autostart", ());
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        builder = builder.icon(icon);
    }
    builder.build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[allow(unused_mut)]
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            show_main(app);
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ));

    // tauri-nspanel must be registered before any window is converted to a panel.
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }

    builder
        .manage(capture::CaptureState::default())
        .manage(capture::WindowsState::default())
        .manage(pin::PinState::default())
        .invoke_handler(tauri::generate_handler![
            commands::platform_info,
            commands::scan_apps,
            commands::launch,
            commands::extract_icon,
            commands::run_action,
            commands::list_dir,
            commands::read_text_file,
            commands::write_text_file,
            commands::convert_images,
            commands::read_image,
            export::clipboard_write_image,
            export::save_rgba_png,
            capture::start_capture,
            capture::capture_frame_bytes,
            capture::capture_windows,
            capture::reveal_capture,
            capture::dispose_capture,
            pin::pin_image_rgba,
            pin::take_pin_image,
        ])
        .setup(|app| {
            build_tray(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
