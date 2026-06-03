.pragma library

function writeJsonFile(path, data) {
    var xhr = new XMLHttpRequest();
    xhr.open("PUT", "file://" + path, false);
    xhr.send(JSON.stringify(data, null, 2));
}

function sanitizeName(name) {
    return (name || "").replace(/[^\w\s\-]/g, "").replace(/\s+/g, "_");
}

function dirFromPath(filePath) {
    var i = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
    return i > -1 ? filePath.substring(0, i) : filePath;
}
