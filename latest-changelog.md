## What's Changed

Mini Diarium now offers the full interface in Russian and Simplified Chinese, and the native menu follows the selected language. The Linux Flatpak also ships the `ru_RU` spell check dictionary, while Chinese spell check stays a documented exception.

### Added

- **Russian translation (#344)**: The full interface (733 strings) is available in Russian. Select "Русский" in Preferences → General → Language. The native menu ("Файл", "Настройки...") follows the selected language, and on Linux spell check uses the `ru_RU` dictionary, which the Flatpak now bundles. Thanks to [@d1nch](https://github.com/d1nch) for the translation. Known limitation: the app has only singular and plural word forms, so counts such as 2–4 use the Russian "many" form.
- **Simplified Chinese translation (#354)**: The full interface (733 strings) is available in Simplified Chinese. Select "简体中文" in Preferences → General → Language. The native menu ("文件", "首选项...") follows the selected language. On Linux, Chinese is a documented spell check exception: the Flatpak does not bundle a `zh_CN` dictionary, so the spell check warning remains until you install one. Thanks to [@wcxu21](https://github.com/wcxu21) for the translation.
