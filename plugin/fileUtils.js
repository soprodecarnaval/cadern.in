.pragma library

function writeJsonFile(path, data) {
    var xhr = new XMLHttpRequest();
    xhr.open("PUT", "file://" + path, false);
    xhr.setRequestHeader("Content-Type", "application/json; charset=utf-8");
    xhr.send(JSON.stringify(data, null, 2));
}

// Strip only filesystem-unsafe characters; preserve unicode letters (é, ç, ã, …).
function sanitizeName(name) {
    return (name || "").replace(/[\/\\:*?"<>|]/g, "").replace(/\s+/g, "_");
}

function dirFromPath(filePath) {
    var i = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
    return i > -1 ? filePath.substring(0, i) : filePath;
}
