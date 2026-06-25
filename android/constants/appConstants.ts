import * as FileSystem from 'expo-file-system/legacy';

export const DOWNLOADS_DIR = 'file:///storage/emulated/0/Download/';

export const CONFIG_PATH = (FileSystem.documentDirectory ?? '') + 'pdf_flick_config.json';
