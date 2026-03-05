import multer from 'multer';
import { ALLOWED_FILE_TYPES, MAX_FILE_SIZE } from '../constants/fileTypes.js';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: MAX_FILE_SIZE
    },
    fileFilter: (req, file, cb) => {
        if (ALLOWED_FILE_TYPES.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Only PDF and text files are allowed'));
        }
    }
});

export default upload;
