const temp = require('temp')
const fs = require('fs')
const fse = require('fs-extra')
//var extract = require('extract-zip')
const crypto = require('crypto');
const path = require('path')
const childProcess = require('child_process')
const {GitProcess} = require('dugite')
const request = require('request')
const semver = require('semver')
const rootPackageJson = require('../package.json')

let tempDir
temp.track()   // track and cleanup files at exit

const files = [
  'cli.js',
  'index.js',
  'install.js',
  'package.json',
  'README.md',
  'LICENSE'
]

const jsonFields = [
  'name',
  'version',
  'repository',
  'description',
  'license',
  'author',
  'keywords'
]

let npmTag = ''

new Promise((resolve, reject) => {
  temp.mkdir('electron-npm', (err, dirPath) => {
    if (err) {
      reject(err)
    } else {
      resolve(dirPath)
    }
  })
})
.then((dirPath) => {
  tempDir = dirPath
  console.log("Temp dir for package preparation: "+tempDir)
  // copy files from `/npm` to temp directory
  files.forEach((name) => {
    const noThirdSegment = name === 'README.md' || name === 'LICENSE'
    fs.writeFileSync(
      path.join(tempDir, name),
      fs.readFileSync(path.join(__dirname, '..', noThirdSegment ? '' : 'npm', name))
    )
  })
  console.log("Copy info root package.json to temp/package.json ")
  // copy from root package.json to temp/package.json
  const packageJson = require(path.join(tempDir, 'package.json'))
  jsonFields.forEach((fieldName) => {
    packageJson[fieldName] = rootPackageJson[fieldName]
  })
  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  )
 
  //fs.writeFileSync(path.join(tempDir, 'path.txt'), 'dist/electron.exe')
  
  //copy electron.d.ts
  electronts_source = path.join(__dirname, '..',"node_modules","electron-typescript-definitions", 'electron.d.ts')
  electronts_dest = path.join(tempDir, 'electron.d.ts')
  console.log("Copy ts file from: " + electronts_source )
  fs.copyFileSync(electronts_source , electronts_dest)
  
  console.log("Start making package with npm pack ")
  childProcess.execSync('npm pack', { cwd: tempDir } )
  const tarballTempPath = path.join(tempDir, `${rootPackageJson.name}-${rootPackageJson.version}.tgz`);
  const tarballPath = path.join(__dirname, "..", "..", "out", `${rootPackageJson.name}-${rootPackageJson.version}.tgz`);
  
  var source = fs.createReadStream(tarballTempPath)
  var destination = fs.createWriteStream(tarballPath)

  source.pipe(destination, { end: false });
  source.on("end", function(){
    fs.unlinkSync(tarballTempPath);

    console.log("Package crated and can be uploaded to github as a release: " + tarballPath);

    const electrondist_zip_filename = `${rootPackageJson.name}-v${rootPackageJson.version}-win32-x64.zip`
    //const electrondist_zip =  path.join(__dirname, '..',"dist", electrondist_zip_filename) //'electron-v2.0.16-win32-x64.zip')
    //copy dist to file electron-v2.0.16-win32-x64.zip
    const electrondist_zip =  path.join(__dirname, '..',  '..', "out", "Release", "dist.zip") //'electron-v2.0.16-win32-x64.zip')
    console.log("zip with electron binaries have to be uploaded to github too : " + electrondist_zip);

    //generate sha256 file 
    const shasums_file = path.join(__dirname, "..", "..", "out", `SHASUMS256.txt`);
    console.log("Checksum file have to be uploaded to github release too: " + shasums_file);
    var stream = fs.createWriteStream(shasums_file);

    const hash = crypto.createHash('sha256');
    const input = fs.readFileSync(electrondist_zip)
    hash.update(input);
    stream.write(`${hash.digest('hex')}`+ " *"+ electrondist_zip_filename+"\n");

    stream.end();
    stream.on("finish", () => {  }); // not sure why you want to pass a boolean
    stream.on("error", () => {  }); // don't forget this!
  });
})
.catch((err) => {
  console.error(`Error: ${err}`)
  process.exit(1)
})
 