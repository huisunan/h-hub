#[cfg(target_os = "windows")]
mod windows;
#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "linux")]
mod linux;

#[cfg(target_os = "windows")]
pub use windows::*;
#[cfg(target_os = "macos")]
pub use macos::*;
#[cfg(target_os = "linux")]
pub use linux::*;

use base64::Engine;

pub(crate) fn b64(bytes: &[u8]) -> String {
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

pub(crate) fn encode_dynamic_png(img: image::DynamicImage) -> Option<String> {
    let mut cursor = std::io::Cursor::new(Vec::new());
    img.write_to(&mut cursor, image::ImageFormat::Png).ok()?;
    Some(format!(
        "data:image/png;base64,{}",
        b64(&cursor.into_inner())
    ))
}

pub(crate) fn encode_rgba_png(width: u32, height: u32, rgba: Vec<u8>) -> Option<String> {
    let img = image::RgbaImage::from_raw(width, height, rgba)?;
    encode_dynamic_png(image::DynamicImage::ImageRgba8(img))
}

/// Turn a local image file into a data URL. Handles png/jpg/gif/webp/svg/ico.
pub fn image_file_data_url(path: &str) -> Option<String> {
    let ext = std::path::Path::new(path)
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let bytes = std::fs::read(path).ok()?;
    match ext.as_str() {
        "png" => Some(format!("data:image/png;base64,{}", b64(&bytes))),
        "jpg" | "jpeg" => Some(format!("data:image/jpeg;base64,{}", b64(&bytes))),
        "gif" => Some(format!("data:image/gif;base64,{}", b64(&bytes))),
        "webp" => Some(format!("data:image/webp;base64,{}", b64(&bytes))),
        "svg" => Some(format!("data:image/svg+xml;base64,{}", b64(&bytes))),
        "ico" => {
            let img = image::load_from_memory_with_format(&bytes, image::ImageFormat::Ico).ok()?;
            encode_dynamic_png(img)
        }
        _ => None,
    }
}
