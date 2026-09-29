use crate::model::{AppEntry, FileItem, PlatformInfo};
use crate::platform;

#[tauri::command]
pub fn read_image(path: String) -> Option<String> {
    platform::image_file_data_url(&path)
}

#[tauri::command]
pub fn platform_info() -> PlatformInfo {
    PlatformInfo {
        os: platform::platform_name().to_string(),
        default_shortcut: platform::default_shortcut().to_string(),
        modifier: platform::modifier().to_string(),
    }
}

#[tauri::command]
pub fn scan_apps() -> Vec<AppEntry> {
    platform::scan_apps()
}

#[tauri::command]
pub fn launch(kind: String, target: String, args: Option<Vec<String>>) -> Result<(), String> {
    platform::launch(&kind, &target, &args.unwrap_or_default())
}

#[tauri::command]
pub fn extract_icon(path: String) -> Option<String> {
    platform::icon_data_url(&path)
}

#[tauri::command]
pub fn run_action(id: String) -> Result<(), String> {
    platform::run_action(&id)
}

#[tauri::command]
pub fn list_dir(path: String) -> Result<Vec<FileItem>, String> {
    let entries = std::fs::read_dir(&path).map_err(|e| e.to_string())?;
    let mut items: Vec<FileItem> = entries
        .filter_map(|entry| entry.ok())
        .filter_map(|entry| {
            let file_type = entry.file_type().ok()?;
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') {
                return None;
            }
            Some(FileItem {
                name,
                path: entry.path().to_string_lossy().to_string(),
                is_dir: file_type.is_dir(),
            })
        })
        .collect();
    items.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(items)
}

#[tauri::command]
pub fn read_text_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn convert_images(
    inputs: Vec<String>,
    out_dir: String,
    format: String,
    quality: Option<u8>,
) -> Result<Vec<String>, String> {
    let fmt = format.to_ascii_lowercase();
    std::fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;
    let mut produced = Vec::new();

    for input in inputs {
        let image = image::open(&input).map_err(|e| format!("{input}: {e}"))?;
        let stem = std::path::Path::new(&input)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("image");

        if fmt == "jpg" || fmt == "jpeg" {
            let output = std::path::Path::new(&out_dir).join(format!("{stem}.jpg"));
            let rgb = image.to_rgb8();
            let file = std::fs::File::create(&output).map_err(|e| e.to_string())?;
            let mut encoder = image::codecs::jpeg::JpegEncoder::new_with_quality(
                std::io::BufWriter::new(file),
                quality.unwrap_or(85),
            );
            encoder
                .encode_image(&rgb)
                .map_err(|e| e.to_string())?;
            produced.push(output.to_string_lossy().to_string());
        } else {
            let output = std::path::Path::new(&out_dir).join(format!("{stem}.png"));
            image.to_rgba8().save(&output).map_err(|e| e.to_string())?;
            produced.push(output.to_string_lossy().to_string());
        }
    }

    Ok(produced)
}
