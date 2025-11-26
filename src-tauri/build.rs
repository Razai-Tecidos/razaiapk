use std::{fs, path::Path};

fn main() {
    // Ensure a minimal Windows icon exists to avoid tauri-build failures on dev
    let icons_dir = Path::new("icons");
    if !icons_dir.exists() {
        let _ = fs::create_dir_all(icons_dir);
    }
    let icon_path = icons_dir.join("icon.ico");
    if !icon_path.exists() {
        // 1x1 px white icon (valid ICO) bytes
        let bytes: [u8; 70] = [
            // ICONDIR (6)
            0x00,0x00, 0x01,0x00, 0x01,0x00,
            // ICONDIRENTRY (16)
            0x01, // width
            0x01, // height
            0x00, // color count
            0x00, // reserved
            0x01,0x00, // planes
            0x20,0x00, // bit count = 32
            0x30,0x00,0x00,0x00, // bytes in res = 48
            0x16,0x00,0x00,0x00, // image offset = 22
            // BITMAPINFOHEADER (40)
            0x28,0x00,0x00,0x00, // biSize = 40
            0x01,0x00,0x00,0x00, // biWidth = 1
            0x02,0x00,0x00,0x00, // biHeight = 2 (XOR+AND)
            0x01,0x00, // planes = 1
            0x20,0x00, // bit count = 32
            0x00,0x00,0x00,0x00, // compression = BI_RGB
            0x04,0x00,0x00,0x00, // size image = 4
            0x00,0x00,0x00,0x00, // x ppm
            0x00,0x00,0x00,0x00, // y ppm
            0x00,0x00,0x00,0x00, // clr used
            0x00,0x00,0x00,0x00, // clr important
            // XOR pixel (BGRA) - white opaque
            0xFF,0xFF,0xFF,0xFF,
            // AND mask row (1 bit -> padded to 4 bytes)
            0x00,0x00,0x00,0x00,
        ];
        let _ = fs::write(&icon_path, &bytes);
    }

    tauri_build::build()
}
