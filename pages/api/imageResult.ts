// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { Chatbot } from "../../lib/chatGPT3";

type Data = {
  url: string | null;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>
) {
  const jobId = req.body.jobId as string;
  console.log("Getting image result for job", jobId);

  const headers = {
    Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
    "Content-Type": "application/json",
  };

  let retries = 12;
  while (retries > 0) {
    await new Promise((r) => setTimeout(r, 500));
    const jobStatus = await fetch(
      `https://api.replicate.com/v1/predictions/${jobId}`,
      {
        headers: headers,
      }
    );
    const jobStatusJson = await jobStatus.json();
    if (jobStatusJson.status === "succeeded") {
      res.status(200).json({ url: jobStatusJson.output[0] });
      return;
    }
    retries--;
  }

  res.status(405).json({ url: null });
}
