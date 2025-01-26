const fs = require("fs");
const pFs = require('fs/promises');
const path = require("path");
const glob = require("glob");
const { DOMParser, XMLSerializer } = require("@xmldom/xmldom");

/**
 * Splits a GPX file into smaller files based on the number of route points.
 * @param {string} inputFile - Path to the input GPX file.
 * @param {string} outputDir - Directory where the split files will be saved.
 * @param {number} pointsPerFile - Number of route points per file.
 */
function splitGpx(inputFile, outputDir, pointsPerFile) {
  console.log(`Processing: ${inputFile}`);

  // Read the GPX file
  const gpxContent = fs.readFileSync(inputFile, "utf8");

  // Parse the GPX content
  const parser = new DOMParser();
  const doc = parser.parseFromString(gpxContent, "application/xml");

  // Extract route points
  const routePoints = Array.from(doc.getElementsByTagName("rtept"));
  if (routePoints.length === 0) {
    console.error(`No route points (<rtept>) found in ${inputFile}. Skipping.`);
    return;
  }

  // Split the route points into chunks
  const chunks = [];
  for (let i = 0; i < routePoints.length; i += pointsPerFile) {
    chunks.push(routePoints.slice(i, i + pointsPerFile));
  }

  // Create a subdirectory for the split files of this GPX file
  const baseName = path.basename(inputFile, ".gpx");
  const fileOutputDir = path.join(outputDir, baseName);
  if (!fs.existsSync(fileOutputDir)) {
    fs.mkdirSync(fileOutputDir, { recursive: true });
  }

  // Generate and save each chunk as a new GPX file
  chunks.forEach((chunk, index) => {
    const newDoc = parser.parseFromString(gpxContent, "application/xml");

    // Clear existing route points
    const rte = newDoc.getElementsByTagName("rte")[0];
    while (rte.firstChild) {
      rte.removeChild(rte.firstChild);
    }

    // Add the route name back (optional)
    const rteName = doc.getElementsByTagName("rte")[0].getElementsByTagName("name")[0];
    if (rteName) {
      rte.appendChild(rteName.cloneNode(true));
    }

    // Append the chunk of route points
    chunk.forEach((rtept) => {
      rte.appendChild(rtept);
    });

    // Serialize the updated XML
    const serializer = new XMLSerializer();
    const outputContent = serializer.serializeToString(newDoc);

    // Write the new GPX file
    const outputFileName = `${baseName}_split_${index + 1}.gpx`;
    const outputFilePath = path.join(fileOutputDir, outputFileName);
    fs.writeFileSync(outputFilePath, outputContent, "utf8");
    console.log(`Saved: ${outputFilePath}`);
  });

  console.log(`Finished processing: ${inputFile}`);
}

// Main function to process all GPX files in a directory
function processGpxFiles(inputDir, outputDir, pointsPerFile) {
  const gpxFiles = glob.sync(path.join(inputDir, "*.gpx"));
  if (gpxFiles.length === 0) {
    console.error("No GPX files found in the input directory.");
    return;
  }

  console.log(`Found ${gpxFiles.length} GPX file(s) to process.`);
  gpxFiles.forEach((gpxFile) => {
    splitGpx(gpxFile, outputDir, pointsPerFile);
  });

  console.log("All GPX files processed.");
}

async function clearDirectory(directoryPath) {
  try {
    await pFs.rm(directoryPath, { recursive: true, force: true });
    // Optionally recreate the directory if needed
    await pFs.mkdir(directoryPath);
    console.log(`Cleared all files and folders in ${directoryPath}`);
  } catch (error) {
    console.error(`Error clearing directory: ${error.message}`);
  }
}

// Usage
const inputDir = "./input"; // Replace with your GPX files directory
const outputDir = "./output"; // Replace with your output directory
const pointsPerFile = 50; // Number of track points per file

(async () => {
  await clearDirectory(outputDir)
  processGpxFiles(inputDir, outputDir, pointsPerFile);
})();