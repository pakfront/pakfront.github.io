function database() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('midgard-static', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('projects');
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
export async function saveLocal(project) {
    const db = await database();
    try {
        await new Promise((resolve, reject) => {
            const tx = db.transaction('projects', 'readwrite'); tx.objectStore('projects').put(project, 'current');
            tx.oncomplete = resolve; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
        });
    } finally { db.close(); }
}
export async function loadLocal() {
    const db = await database();
    try {
        return await new Promise((resolve, reject) => {
            const request = db.transaction('projects').objectStore('projects').get('current');
            request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
        });
    } finally { db.close(); }
}
export async function importImage(file, trim = false) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw Error('Use PNG, JPEG or WebP images up to 10 MB each.');
    const bitmap = await createImageBitmap(file);
    try {
        if (bitmap.width * bitmap.height > 20_000_000) throw Error('Images must be at most 20 megapixels.');
        const c = document.createElement('canvas'); c.width = bitmap.width; c.height = bitmap.height;
        const ctx = c.getContext('2d', {willReadFrequently: true}); ctx.drawImage(bitmap, 0, 0);
        let transparent = false;
        if (trim) {
            const {data} = ctx.getImageData(0, 0, c.width, c.height);
            let left = c.width, top = c.height, right = -1, bottom = -1;
            for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
                const alpha = data[(y * c.width + x) * 4 + 3];
                if (alpha < 255) transparent = true;
                if (alpha > 0) { left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y); }
            }
            if (right < left) throw Error('This image is completely transparent.');
            const cropped = document.createElement('canvas'); cropped.width = right - left + 1; cropped.height = bottom - top + 1;
            cropped.getContext('2d').drawImage(c, left, top, cropped.width, cropped.height, 0, 0, cropped.width, cropped.height);
            return {path: cropped.toDataURL('image/png'), transparent};
        }
        return {path: c.toDataURL('image/png'), transparent};
    } finally { bitmap.close(); }
}
