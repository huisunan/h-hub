use tauri::AppHandle;
use tauri_plugin_clipboard_manager::ClipboardExt;

/// Parses a raw body framed as `[width u32 LE][height u32 LE][rgba bytes]`.
pub(crate) fn parse_rgba(body: &[u8]) -> Result<(Vec<u8>, u32, u32), String> {
    if body.len() < 8 {
        return Err("无效的图片数据".to_string());
    }
    let width = u32::from_le_bytes([body[0], body[1], body[2], body[3]]);
    let height = u32::from_le_bytes([body[4], body[5], body[6], body[7]]);
    let expected = width as usize * height as usize * 4;
    if body.len() < 8 + expected {
        return Err("图片数据长度不匹配".to_string());
    }
    Ok((body[8..8 + expected].to_vec(), width, height))
}

/// Writes raw RGBA straight to the clipboard. Avoids the JSON number-array IPC
/// path and any PNG encode/decode round trip.
#[tauri::command]
pub fn clipboard_write_image(app: AppHandle, request: tauri::ipc::Request) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(body) = request.body() else {
        return Err("需要原始图像数据".to_string());
    };
    let (rgba, width, height) = parse_rgba(body)?;
    let image = tauri::image::Image::new_owned(rgba, width, height);
    app.clipboard()
        .write_image(&image)
        .map_err(|error| error.to_string())
}

/// Saves raw RGBA as PNG. Body is framed as
/// `[path_len u32 LE][path utf8][width u32 LE][height u32 LE][rgba bytes]`.
#[tauri::command]
pub fn save_rgba_png(request: tauri::ipc::Request) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(body) = request.body() else {
        return Err("需要原始图像数据".to_string());
    };
    if body.len() < 4 {
        return Err("无效的图片数据".to_string());
    }
    let path_len = u32::from_le_bytes([body[0], body[1], body[2], body[3]]) as usize;
    let start = 4 + path_len;
    if body.len() < start + 8 {
        return Err("无效的图片数据".to_string());
    }
    let path = std::str::from_utf8(&body[4..start]).map_err(|error| error.to_string())?;
    let (rgba, width, height) = parse_rgba(&body[start..])?;
    let image =
        image::RgbaImage::from_raw(width, height, rgba).ok_or_else(|| "图像缓冲无效".to_string())?;
    image.save(path).map_err(|error| error.to_string())
}
