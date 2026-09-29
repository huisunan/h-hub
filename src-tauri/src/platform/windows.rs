use crate::model::AppEntry;
use std::path::PathBuf;
use std::process::Command;
use walkdir::WalkDir;

pub fn platform_name() -> &'static str {
    "windows"
}

pub fn default_shortcut() -> &'static str {
    "Alt+Space"
}

pub fn modifier() -> &'static str {
    "Alt"
}

fn to_wide(s: &str) -> Vec<u16> {
    s.encode_utf16().chain(std::iter::once(0)).collect()
}

pub fn scan_apps() -> Vec<AppEntry> {
    let mut roots: Vec<PathBuf> = Vec::new();
    if let Ok(pd) = std::env::var("ProgramData") {
        roots.push(PathBuf::from(pd).join(r"Microsoft\Windows\Start Menu\Programs"));
    }
    if let Ok(ad) = std::env::var("APPDATA") {
        roots.push(PathBuf::from(ad).join(r"Microsoft\Windows\Start Menu\Programs"));
    }

    let mut out = Vec::new();
    let mut seen = std::collections::HashSet::new();
    for root in roots {
        if !root.exists() {
            continue;
        }
        for entry in WalkDir::new(&root)
            .max_depth(4)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            let path = entry.path();
            if !path.is_file() {
                continue;
            }
            let ext = path
                .extension()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .to_ascii_lowercase();
            if ext != "lnk" && ext != "url" {
                continue;
            }
            let name = path
                .file_stem()
                .and_then(|s| s.to_str())
                .unwrap_or("")
                .trim()
                .to_string();
            if name.is_empty() {
                continue;
            }
            let target = path.to_string_lossy().to_string();
            if !seen.insert(target.to_ascii_lowercase()) {
                continue;
            }
            out.push(AppEntry {
                id: format!("win:{}", target.to_ascii_lowercase()),
                name,
                target,
                icon: None,
                source: "start-menu".into(),
                args: Vec::new(),
            });
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    out
}

pub fn launch(kind: &str, target: &str, args: &[String]) -> Result<(), String> {
    if kind == "shell" {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", target]);
        for arg in args {
            cmd.arg(arg);
        }
        cmd.spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }

    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::ShellExecuteW;
    use windows::Win32::UI::WindowsAndMessaging::SW_SHOWNORMAL;

    let wide_target = to_wide(target);
    let wide_op = to_wide("open");
    let result = unsafe {
        ShellExecuteW(
            None,
            PCWSTR(wide_op.as_ptr()),
            PCWSTR(wide_target.as_ptr()),
            PCWSTR::null(),
            PCWSTR::null(),
            SW_SHOWNORMAL,
        )
    };
    if result.0 as isize <= 32 {
        return Err(format!("ShellExecuteW failed (code {})", result.0 as isize));
    }
    Ok(())
}

pub fn icon_data_url(path: &str) -> Option<String> {
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".lnk") || lower.ends_with(".exe") || lower.ends_with(".url") {
        if let Some(icon) = unsafe { extract_shell_icon(path) } {
            return Some(icon);
        }
    }
    crate::platform::image_file_data_url(path)
}

unsafe fn extract_shell_icon(path: &str) -> Option<String> {
    use windows::core::PCWSTR;
    use windows::Win32::UI::Shell::{SHGetFileInfoW, SHFILEINFOW, SHGFI_ICON, SHGFI_LARGEICON};
    use windows::Win32::UI::WindowsAndMessaging::DestroyIcon;

    let wide = to_wide(path);
    let mut info = SHFILEINFOW::default();
    let result = SHGetFileInfoW(
        PCWSTR(wide.as_ptr()),
        Default::default(),
        Some(&mut info),
        std::mem::size_of::<SHFILEINFOW>() as u32,
        SHGFI_ICON | SHGFI_LARGEICON,
    );
    if result == 0 || info.hIcon.is_invalid() {
        return None;
    }
    let hicon = info.hIcon;
    let png = hicon_to_png(hicon);
    let _ = DestroyIcon(hicon);
    png
}

unsafe fn hicon_to_png(hicon: windows::Win32::UI::WindowsAndMessaging::HICON) -> Option<String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::{
        DeleteObject, GetDC, GetDIBits, GetObjectW, ReleaseDC, BITMAP, BITMAPINFO,
        BITMAPINFOHEADER, DIB_RGB_COLORS, HGDIOBJ,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetIconInfo, ICONINFO};

    let mut icon_info = ICONINFO::default();
    GetIconInfo(hicon, &mut icon_info).ok()?;

    let hbm_color = icon_info.hbmColor;
    let hbm_mask = icon_info.hbmMask;

    let cleanup = |color: windows::Win32::Graphics::Gdi::HBITMAP,
                   mask: windows::Win32::Graphics::Gdi::HBITMAP| {
        unsafe {
            if !color.is_invalid() {
                let _ = DeleteObject(HGDIOBJ(color.0));
            }
            if !mask.is_invalid() {
                let _ = DeleteObject(HGDIOBJ(mask.0));
            }
        }
    };

    if hbm_color.is_invalid() {
        cleanup(hbm_color, hbm_mask);
        return None;
    }

    let mut bitmap = BITMAP::default();
    let got = GetObjectW(
        HGDIOBJ(hbm_color.0),
        std::mem::size_of::<BITMAP>() as i32,
        Some(&mut bitmap as *mut _ as *mut std::ffi::c_void),
    );
    if got == 0 {
        cleanup(hbm_color, hbm_mask);
        return None;
    }

    let width = bitmap.bmWidth;
    let height = bitmap.bmHeight;
    if width <= 0 || height <= 0 || width > 1024 || height > 1024 {
        cleanup(hbm_color, hbm_mask);
        return None;
    }

    let hdc = GetDC(HWND(std::ptr::null_mut()));
    let mut bmi = BITMAPINFO::default();
    bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
    bmi.bmiHeader.biWidth = width;
    bmi.bmiHeader.biHeight = -height;
    bmi.bmiHeader.biPlanes = 1;
    bmi.bmiHeader.biBitCount = 32;
    bmi.bmiHeader.biCompression = 0;

    let mut buffer = vec![0u8; (width as usize) * (height as usize) * 4];
    let lines = GetDIBits(
        hdc,
        hbm_color,
        0,
        height as u32,
        Some(buffer.as_mut_ptr() as *mut std::ffi::c_void),
        &mut bmi,
        DIB_RGB_COLORS,
    );
    let _ = ReleaseDC(HWND(std::ptr::null_mut()), hdc);

    cleanup(hbm_color, hbm_mask);
    if lines == 0 {
        return None;
    }

    let has_alpha = buffer.chunks_exact(4).any(|px| px[3] != 0);
    let mut rgba = vec![0u8; buffer.len()];
    for (src, dst) in buffer.chunks_exact(4).zip(rgba.chunks_exact_mut(4)) {
        dst[0] = src[2];
        dst[1] = src[1];
        dst[2] = src[0];
        dst[3] = if has_alpha { src[3] } else { 255 };
    }

    crate::platform::encode_rgba_png(width as u32, height as u32, rgba)
}

/// Capture the primary display with GDI BitBlt and write it to a PNG file,
/// returning the file path.
pub fn capture_primary_display_to_file() -> Result<String, String> {
    use windows::Win32::Foundation::HWND;
    use windows::Win32::Graphics::Gdi::{
        BitBlt, CreateCompatibleBitmap, CreateCompatibleDC, DeleteDC, DeleteObject, GetDC,
        GetDIBits, ReleaseDC, SelectObject, BITMAPINFO, BITMAPINFOHEADER, DIB_RGB_COLORS, HGDIOBJ,
        SRCCOPY,
    };
    use windows::Win32::UI::WindowsAndMessaging::{GetSystemMetrics, SM_CXSCREEN, SM_CYSCREEN};

    unsafe {
        let width = GetSystemMetrics(SM_CXSCREEN);
        let height = GetSystemMetrics(SM_CYSCREEN);
        if width <= 0 || height <= 0 {
            return Err("无法获取屏幕尺寸".to_string());
        }

        let screen_dc = GetDC(HWND(std::ptr::null_mut()));
        if screen_dc.is_invalid() {
            return Err("无法获取屏幕 DC".to_string());
        }
        let mem_dc = CreateCompatibleDC(screen_dc);
        let bitmap = CreateCompatibleBitmap(screen_dc, width, height);
        let previous = SelectObject(mem_dc, HGDIOBJ(bitmap.0));

        let blit = BitBlt(mem_dc, 0, 0, width, height, screen_dc, 0, 0, SRCCOPY);

        let mut bmi = BITMAPINFO::default();
        bmi.bmiHeader.biSize = std::mem::size_of::<BITMAPINFOHEADER>() as u32;
        bmi.bmiHeader.biWidth = width;
        bmi.bmiHeader.biHeight = -height;
        bmi.bmiHeader.biPlanes = 1;
        bmi.bmiHeader.biBitCount = 32;
        bmi.bmiHeader.biCompression = 0;

        let mut buffer = vec![0u8; (width as usize) * (height as usize) * 4];
        let lines = GetDIBits(
            mem_dc,
            bitmap,
            0,
            height as u32,
            Some(buffer.as_mut_ptr() as *mut std::ffi::c_void),
            &mut bmi,
            DIB_RGB_COLORS,
        );

        SelectObject(mem_dc, previous);
        let _ = DeleteObject(HGDIOBJ(bitmap.0));
        let _ = DeleteDC(mem_dc);
        let _ = ReleaseDC(HWND(std::ptr::null_mut()), screen_dc);

        blit.map_err(|error| error.to_string())?;
        if lines == 0 {
            return Err("截图失败".to_string());
        }

        let has_alpha = buffer.chunks_exact(4).any(|px| px[3] != 0);
        let mut rgba = vec![0u8; buffer.len()];
        for (src, dst) in buffer.chunks_exact(4).zip(rgba.chunks_exact_mut(4)) {
            dst[0] = src[2];
            dst[1] = src[1];
            dst[2] = src[0];
            dst[3] = if has_alpha { src[3] } else { 255 };
        }

        let image = image::RgbaImage::from_raw(width as u32, height as u32, rgba)
            .ok_or_else(|| "图像缓冲无效".to_string())?;

        let temp = std::env::temp_dir().join(format!(
            "hhub-capture-{}-{}.png",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_millis())
                .unwrap_or(0)
        ));
        image::DynamicImage::ImageRgba8(image)
            .save(&temp)
            .map_err(|error| error.to_string())?;
        Ok(temp.to_string_lossy().to_string())
    }
}

pub fn run_action(id: &str) -> Result<(), String> {
    let spawn = |program: &str, args: &[&str]| -> Result<(), String> {
        Command::new(program)
            .args(args)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    };
    match id {
        "lock" => spawn("rundll32.exe", &["user32.dll,LockWorkStation"]),
        "backDesktop" => spawn(
            "powershell",
            &[
                "-NoProfile",
                "-WindowStyle",
                "Hidden",
                "-Command",
                "(New-Object -ComObject Shell.Application).ToggleDesktop()",
            ],
        ),
        "screenshot" => spawn("explorer", &["ms-screenclip:"]),
        _ => Err(format!("unknown action: {id}")),
    }
}
