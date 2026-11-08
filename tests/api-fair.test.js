import test from "node:test";
import assert from "node:assert/strict";
import { evaluatePublishManifest } from "../functions/api/publish-site.js";

const manifest='<manifest>\n getData * UserPlan,\n if UserPlan = Free put domain "(name-web).aistudio.fair"\n</manifest>';

test("Free plan manifest maps a requested project name to aistudio.fair",()=>{
 const result=evaluatePublishManifest(manifest,"mi-proyecto", "Free");
 assert.deepEqual(result,{ok:true,domain:"mi-proyecto-web.aistudio.fair",plan:"Free"});
});

test("Free plan rejects custom domains without a matching manifest rule",()=>{
 const result=evaluatePublishManifest("<manifest></manifest>","miweb.fair","Free");
 assert.equal(result.ok,false);
 assert.equal(result.error,"free_plan_domain_required");
});

test("manifest does not override a non-matching plan",()=>{
 const result=evaluatePublishManifest(manifest,"mi-proyecto.aistudio.fair","Pro");
 assert.equal(result.ok,true);
 assert.equal(result.domain,"mi-proyecto.aistudio.fair");
});

test("manifest rejects traversal or invalid host output",()=>{
 const result=evaluatePublishManifest('<manifest>getData * UserPlan, if UserPlan = Free put domain "../evil"</manifest>',"site","Free");
 assert.equal(result.ok,false);
 assert.equal(result.error,"invalid_domain");
});
