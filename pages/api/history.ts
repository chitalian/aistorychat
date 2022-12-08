// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";
import { supabaseServer } from "../../lib/supabaseServer";
import { promptsDB } from "./log";

type Data = promptsDB[];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data | { error: string }>
) {
  const { id } = req.query;

  console.log("Getting history for", id);

  const { data: promptRow, error: promptRowError } = await supabaseServer
    .from("prompts")
    .select("openai_conversation_id")
    .eq("id", id)
    .single();

  if (promptRowError) {
    console.log(promptRowError);
    res.status(405).json({ error: promptRowError.message });
    return;
  }
  console.log("conversation!", promptRow.openai_conversation_id);
  const { data, error } = await supabaseServer
    .from("prompts")
    .select("*")
    .eq("openai_conversation_id", promptRow.openai_conversation_id);

  if (error) {
    console.log(error);
    res.status(405).json({ error: error.message });
    return;
  }

  const prompts = data as promptsDB[];

  let history = [];

  let pointer: string | null = id as string;
  while (pointer) {
    const prompt = prompts.find((p) => p.id === pointer);
    if (!prompt) {
      break;
    }
    history.push(prompt);
    pointer = prompt.last_id;
  }

  res.status(200).json(history.reverse());
}
