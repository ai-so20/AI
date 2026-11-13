import {readFileSync,writeFileSync,mkdirSync} from "node:fs";
import {dirname,resolve} from "node:path";

const root=resolve(import.meta.dirname,"..");
const source=resolve(root,"native/MainActivity.java");
const destination=resolve(root,"android/app/src/main/java/com/vipai/aiprocess/smoketest/MainActivity.java");
const manifestFile=resolve(root,"android/app/src/main/AndroidManifest.xml");

const sourceText=readFileSync(source,"utf8");
if(!sourceText.includes("extends BridgeActivity"))throw Error("Native activity should extend BridgeActivity");
mkdirSync(dirname(destination),{recursive:true});
writeFileSync(destination,sourceText);

let manifest=readFileSync(manifestFile,"utf8");
const pattern=/<activity\b[^>]*android:name="\.MainActivity"[^>]*>/g;
const matches=[...manifest.matchAll(pattern)];
if(matches.length!==1)throw Error("Expected one generated .MainActivity in AndroidManifest.xml");
manifest=manifest.replace(pattern,tag=>{
  if(/android:windowSoftInputMode=/.test(tag)){
    return tag.replace(/android:windowSoftInputMode="[^"]*"/,'android:windowSoftInputMode="adjustResize"');
  }
  return tag.slice(0,-1)+' android:windowSoftInputMode="adjustResize">';
});
writeFileSync(manifestFile,manifest);
console.log("Native MainActivity overlaid and adjustResize set on generated Android manifest");
