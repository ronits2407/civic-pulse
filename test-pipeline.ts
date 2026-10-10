import { createServiceClient } from './lib/db/server';
import { createIssuePipeline } from './lib/agents/pipeline';
import fs from 'fs';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function main() {
  const supabase = createServiceClient();
  const localFile = "C:\\Users\\RONIT\\Downloads\\istockphoto-171276431-612x612.jpg";
  const imageData = fs.readFileSync(localFile);
  const filename = `test/${Date.now()}.jpg`;
  
  console.log("Uploading test image...");
  const { data: upload, error: uploadError } = await supabase.storage
    .from('issue-media')
    .upload(filename, imageData, { contentType: 'image/jpeg' });

  if (uploadError) {
    console.error("Upload failed:", uploadError);
    return;
  }

  const { data: urlData } = supabase.storage
    .from('issue-media')
    .getPublicUrl(upload.path);
  const imageUrl = urlData.publicUrl;

  const { data: profile } = await supabase.from('profiles').select('id').limit(1).single();
  const dummyUserId = profile?.id;

  const { data: issue, error: issueError } = await supabase.from('issues').insert({
    user_id: dummyUserId,
    description: 'A test report for image analysis',
    photo_url: imageUrl,
    location: 'POINT(74.664769 19.452757)',
    address: 'Taklimiya, Maharashtra',
    status: 'open',
    pipeline_stage: 'agent1_classifier'
  }).select().single();

  const initialState = {
    reportId: issue.id,
    rawText: 'A test report for image analysis',
    imageUrl: imageUrl,
    coordinates: { lat: 19.452757, lng: 74.664769 },
    userId: dummyUserId,
    classification: null,
    deduplication: null,
    validation: null,
    resolution: null,
    error: null,
    imageAnalysis: ''
  };

  const pipeline = await createIssuePipeline();
  console.log("Invoking pipeline...");
  const finalState = await pipeline.invoke(initialState);
  console.log("Pipeline finished.");
  
  if (finalState.resolution?.civic_brief) {
    console.log("Brief:", finalState.resolution.civic_brief);
  } else {
    console.log("No civic brief found in final state.", finalState);
  }
}

main();
