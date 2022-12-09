// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { Chatbot } from "../../lib/chatGPT3";

type Data = {
  jobId: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const prompt = req.body.input.prompt as string;

  console.log("Queueing image request", prompt);
  const url = "https://api.replicate.com/v1/predictions";
  const headers = {
    Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
    "Content-Type": "application/json",
  };
  const body = {
    version: "27b93a2413e7f36cd83da926f3656280b2931564ff050bf9575f1fdf9bcd7478",
    input: {
      prompt: `${prompt}, intricate details, shot on portra 400, film grain, color photo, cinematic lighting, 4k`,
      negative_prompt:
        // credit https://www.reddit.com/r/StableDiffusion/comments/zdbi1u/robot_selfies_redshift_diffusion_786/
        "nsfw, lowres, bad anatomy, bad hands, text, error, missing fingers, extra digit, fewer digits, cropped, worst quality, low quality, normal quality, jpegartifacts, signature, watermark, username, blurry, bad feet ,cropped,poorly drawn hands,poorly drawn face,mutation,deformed,worst quality,low quality,normal quality,jpeg artifacts,signature,watermark,extra fingers,fewer digits,extra limbs,extra arms,extra legs,malformed limbs,fused fingers, too many fingers, long neck, cross-eyed",
    },
  };

  const replicateJobResponse = await fetch(url, {
    method: "POST",
    headers: headers,
    body: JSON.stringify(body),
  });

  const replicateJob = await replicateJobResponse.json();

  res.status(405).json({ jobId: replicateJob.id });
}
