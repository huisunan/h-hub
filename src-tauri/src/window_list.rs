use serde::Serialize;

/// A window's bounds in physical screen pixels (top-left origin).
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowRect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// On-screen, normal-level windows ordered front-to-back, excluding our own
/// process. Coordinates are in **points** (multiply by the display scale for
/// physical pixels).
#[cfg(target_os = "macos")]
pub fn list_windows() -> Vec<WindowRect> {
    use core_foundation::base::TCFType;
    use core_foundation::string::CFString;
    use core_foundation_sys::array::{CFArrayGetCount, CFArrayGetValueAtIndex, CFArrayRef};
    use core_foundation_sys::base::{CFRelease, CFTypeRef};
    use core_foundation_sys::dictionary::{CFDictionaryGetValue, CFDictionaryRef};
    use core_graphics::window::{
        kCGWindowBounds, kCGWindowLayer, kCGWindowListExcludeDesktopElements,
        kCGWindowListOptionOnScreenOnly, kCGWindowOwnerPID, CGWindowListCopyWindowInfo,
    };

    let mut out = Vec::new();
    let own_pid = std::process::id() as i32;

    unsafe {
        let option = kCGWindowListOptionOnScreenOnly | kCGWindowListExcludeDesktopElements;
        let array: CFArrayRef = CGWindowListCopyWindowInfo(option, 0);
        if array.is_null() {
            return out;
        }

        let count = CFArrayGetCount(array);
        let key_x = CFString::new("X");
        let key_y = CFString::new("Y");
        let key_w = CFString::new("Width");
        let key_h = CFString::new("Height");

        for index in 0..count {
            let dict = CFArrayGetValueAtIndex(array, index) as CFDictionaryRef;
            if dict.is_null() {
                continue;
            }

            let layer = read_i32(dict, kCGWindowLayer as *const std::ffi::c_void).unwrap_or(0);
            if layer != 0 {
                continue;
            }
            let pid = read_i32(dict, kCGWindowOwnerPID as *const std::ffi::c_void).unwrap_or(0);
            if pid == own_pid {
                continue;
            }

            let bounds = CFDictionaryGetValue(dict, kCGWindowBounds as *const std::ffi::c_void)
                as CFDictionaryRef;
            if bounds.is_null() {
                continue;
            }

            let (Some(x), Some(y), Some(width), Some(height)) = (
                read_f64(bounds, key_x.as_concrete_TypeRef()),
                read_f64(bounds, key_y.as_concrete_TypeRef()),
                read_f64(bounds, key_w.as_concrete_TypeRef()),
                read_f64(bounds, key_h.as_concrete_TypeRef()),
            ) else {
                continue;
            };
            if width < 4.0 || height < 4.0 {
                continue;
            }
            out.push(WindowRect {
                x,
                y,
                width,
                height,
            });
        }

        CFRelease(array as CFTypeRef);
    }

    out
}

#[cfg(target_os = "macos")]
unsafe fn read_i32(
    dict: core_foundation_sys::dictionary::CFDictionaryRef,
    key: *const std::ffi::c_void,
) -> Option<i32> {
    use core_foundation_sys::dictionary::CFDictionaryGetValue;
    use core_foundation_sys::number::{kCFNumberSInt32Type, CFNumberGetValue, CFNumberRef};

    let value = CFDictionaryGetValue(dict, key) as CFNumberRef;
    if value.is_null() {
        return None;
    }
    let mut number: i32 = 0;
    let ok = CFNumberGetValue(
        value,
        kCFNumberSInt32Type,
        &mut number as *mut i32 as *mut std::ffi::c_void,
    );
    ok.then_some(number)
}

#[cfg(target_os = "macos")]
unsafe fn read_f64(
    dict: core_foundation_sys::dictionary::CFDictionaryRef,
    key: core_foundation_sys::string::CFStringRef,
) -> Option<f64> {
    use core_foundation_sys::dictionary::CFDictionaryGetValue;
    use core_foundation_sys::number::{kCFNumberDoubleType, CFNumberGetValue, CFNumberRef};

    let value = CFDictionaryGetValue(dict, key as *const std::ffi::c_void) as CFNumberRef;
    if value.is_null() {
        return None;
    }
    let mut number: f64 = 0.0;
    let ok = CFNumberGetValue(
        value,
        kCFNumberDoubleType,
        &mut number as *mut f64 as *mut std::ffi::c_void,
    );
    ok.then_some(number)
}

#[cfg(not(target_os = "macos"))]
pub fn list_windows() -> Vec<WindowRect> {
    Vec::new()
}
