function getExtension(filename) {
  return filename.toLowerCase().split('.').pop();
}

// glb, fbx
export default function createURL(event, modelType) {
  const files = [];
  if (event.dataTransfer.items) {
    // Use DataTransferItemList interface to access the file(s)
    for (var i = 0; i < event.dataTransfer.items.length; i++) {
      // If dropped items aren't files, reject them
      if (event.dataTransfer.items[i].kind === "file") {
        var file = event.dataTransfer.items[i].getAsFile();
        files.push(file, modelType);
      }
    }
  } else {
    files = event.dataTransfer.files;
  }

  const entryFile = files.find(f => getExtension(f.name) === modelType);
  if (entryFile == undefined) {
    console.error('Could not find any supported 3D model files.')
    return undefined;
  }
  const fileUrl = URL.createObjectURL(entryFile);
  return fileUrl;
}