const fs = require("fs");
const pFs = require("fs/promises");
const path = require("path");
const glob = require("glob");
const { DOMParser, XMLSerializer } = require("@xmldom/xmldom");
const prettier = require("prettier");

/**
 * Splits a GPX file into smaller files based on the number of route points.
 * @param {string} inputFile - Path to the input GPX file.
 * @param {string} outputDir - Directory where the split files will be saved.
 * @param {number} pointsPerFile - Number of route points per file.
 */
async function splitGpx(inputFile, outputDir, pointsPerFile) {
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

  // Dynamically import Prettier XML plugin once
  const pluginXml = await import("@prettier/plugin-xml");

  // Generate and save each chunk as a new GPX file
  for (const [index, chunk] of chunks.entries()) {
    const newDoc = parser.parseFromString(gpxContent, "application/xml");

    // Update <name> in <metadata> and <rte>
    const metadataName = newDoc.getElementsByTagName("name")[0];
    if (metadataName) {
      metadataName.textContent = `${baseName} (Part ${index + 1})`;
    }

    const rte = newDoc.getElementsByTagName("rte")[0];
    const rteName = rte.getElementsByTagName("name")[0];
    if (rteName) {
      rteName.textContent = `${baseName} (Part ${index + 1})`;
    }

    // Clear existing route points
    while (rte.firstChild) {
      rte.removeChild(rte.firstChild);
    }

    // Add the updated route name back (optional)
    if (rteName) {
      rte.appendChild(rteName.cloneNode(true));
    }

    // Append the chunk of route points
    chunk.forEach((rtept, rteptIndex) => {
      // Replace or add <type>start</type> to the first route point
      if (rteptIndex === 0) {
        let typeElement = rtept.getElementsByTagName("type")[0];
        if (typeElement) {
          typeElement.textContent = "start"; // Replace existing value
        } else {
          typeElement = newDoc.createElement("type");
          typeElement.textContent = "start";
          rtept.appendChild(typeElement);
        }
      }

      // Replace or add <type>destination</type> to the last route point
      if (rteptIndex === chunk.length - 1) {
        let typeElement = rtept.getElementsByTagName("type")[0];
        if (typeElement) {
          typeElement.textContent = "destination"; // Replace existing value
        } else {
          typeElement = newDoc.createElement("type");
          typeElement.textContent = "destination";
          rtept.appendChild(typeElement);
        }
      }

      rte.appendChild(rtept);
    });

    // Serialize the updated XML
    const serializer = new XMLSerializer();
    const outputContent = serializer.serializeToString(newDoc);

    // Format the output XML using Prettier with the dynamically loaded plugin
    const formattedContent = await prettier.format(outputContent, {
      parser: "xml",
      plugins: [pluginXml.default],
      xmlSelfClosingSpace: false,
      tabWidth: 2,
      printWidth: 80, // Wrap lines at a readable width
    });

    // Write the new GPX file
    const outputFileName = `${baseName}_split_${index + 1}.gpx`;
    const outputFilePath = path.join(fileOutputDir, outputFileName);

    fs.writeFileSync(outputFilePath, formattedContent, "utf8");
    console.log(`Saved: ${outputFilePath}`);
  }

  console.log(`Finished processing: ${inputFile}`);
}

// Main function to process all GPX files in a directory
async function processGpxFiles(inputDir, outputDir, pointsPerFile) {
  const gpxFiles = glob.sync(path.join(inputDir, "*.gpx"));

  if (gpxFiles.length === 0) {
    console.error("No GPX files found in the input directory.");
    return;
  }

  console.log(`Found ${gpxFiles.length} GPX file(s) to process.`);

  await Promise.all(gpxFiles.map((gpxFile) => {
    splitGpx(gpxFile, outputDir, pointsPerFile);
  }));

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
  await clearDirectory(outputDir);

  await processGpxFiles(inputDir, outputDir, pointsPerFile);
})();