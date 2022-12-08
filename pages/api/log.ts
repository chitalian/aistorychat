// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
// import { supabaseServer } from "../../lib/supabaseServer";

export interface promptsDB {
  id: string;
  input: string;
  response_message: string;
  image_url: string;
  image_prompt: string;
  response_without_image: string;
  last_id: string | null;
  openai_parent_id: string | null;
  openai_conversation_id: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<{}>
) {
  const body: promptsDB = req.body;
  console.log("Logging prompt", body);

  // const { data, error } = await supabaseServer
  //   .from("prompts")
  //   .insert(body)
  //   .select("id")
  //   .single();
  // if (error) {
  //   console.log(error);
  //   res.status(405).json({ error: error.message });
  //   return;
  // }

  res.status(200).json({});
}
