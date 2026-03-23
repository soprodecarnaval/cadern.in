// script runner that grabs all the scripts in the scripts folder and runs them
// by consuming the first cli arg, which has the script name
// imports are dynamic to avoid loading problematic dependencies (e.g. JWT + Node v25)

const main = async () => {
  const script = process.argv[2];
  if (!script) {
    console.error("ERROR: script name is required");
    return;
  }

  switch (script) {
    case "downloadGoogleDrive": {
      const { default: downloadGoogleDrive } = await import("./downloadGoogleDrive");
      await downloadGoogleDrive(process.argv.slice(3));
      break;
    }
    case "buildSongbook": {
      const { default: buildSongbook } = await import("./buildSongbook");
      await buildSongbook(process.argv.slice(3));
      break;
    }
    default:
      console.error(`ERROR: script '${script}' not found`);
  }
};

main();
