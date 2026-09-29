use base64::Engine;
use std::collections::HashMap;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;
use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

/// Maps a pinned window label to its PNG data URL until the window claims it.
#[derive(Default)]
pub struct PinState(pub Mutex<HashMap<String, String>>);

static PIN_SEQ: AtomicUsize = AtomicUsize::new(0);

/// Open a floating always-on-top window from raw RGBA (no PNG round trip on the
/// frontend). The image is encoded once to PNG, stored as a data URL and handed
/// to the pin window.
#[tauri::command]
pub fn pin_image_rgba(
    app: AppHandle,
    state: tauri::State<PinState>,
    request: tauri::ipc::Request,
) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(body) = request.body() else {
        return Err("需要原始图像数据".to_string());
    };
    let (rgba, width, height) = crate::export::parse_rgba(body)?;
    let image =
        image::RgbaImage::from_raw(width, height, rgba).ok_or_else(|| "图像缓冲无效".to_string())?;

    let mut cursor = std::io::Cursor::new(Vec::new());
    image::DynamicImage::ImageRgba8(image)
        .write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|error| error.to_string())?;
    let data_url = format!(
        "data:image/png;base64,{}",
        base64::engine::general_purpose::STANDARD.encode(cursor.into_inner())
    );

    spawn_pin(&app, &state, data_url, width, height)
}

fn spawn_pin(
    app: &AppHandle,
    state: &PinState,
    data_url: String,
    width: u32,
    height: u32,
) -> Result<(), String> {
    let scale = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|monitor| monitor.scale_factor())
        .unwrap_or(1.0);
    let monitor_size = app
        .primary_monitor()
        .ok()
        .flatten()
        .map(|monitor| {
            let size = monitor.size();
            (size.width as f64 / scale, size.height as f64 / scale)
        })
        .unwrap_or((1440.0, 900.0));

    let logical_width = width as f64 / scale;
    let logical_height = height as f64 / scale;
    let ratio = (monitor_size.0 * 0.92 / logical_width)
        .min(monitor_size.1 * 0.92 / logical_height)
        .min(1.0);

    let label = format!("pin-{}", PIN_SEQ.fetch_add(1, Ordering::SeqCst));
    state
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .insert(label.clone(), data_url);

    WebviewWindowBuilder::new(app, &label, WebviewUrl::App("pin.html".into()))
        .title("h-hub pin")
        .decorations(false)
        .transparent(true)
        .shadow(true)
        .resizable(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(true)
        .inner_size(
            (logical_width * ratio).max(80.0),
            (logical_height * ratio).max(60.0),
        )
        .build()
        .map_err(|error| error.to_string())?;

    Ok(())
}

/// Consume the data URL for a pinned window (called once on mount).
#[tauri::command]
pub fn take_pin_image(state: tauri::State<PinState>, label: String) -> Option<String> {
    state.0.lock().ok()?.remove(&label)
}
