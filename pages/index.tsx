/* eslint-disable @next/next/no-img-element */
import Head from "next/head";
import Image from "next/image";
import { Dispatch, SetStateAction, useEffect, useState } from "react";
import styles from "../styles/Home.module.css";
import { v4 as uuidv4 } from "uuid";
import { promptsDB } from "./api/log";
import { CiTwitter } from "react-icons/ci";
import { BiCopy } from "react-icons/bi";
import { BiUndo } from "react-icons/bi";
import { useRouter } from "next/router";

function useLocalStorage<T>(
  key: string,
  defaultValue: T
): [T, Dispatch<SetStateAction<T>>] {
  const [checkedLocalStorage, setCheckedLocalStorage] = useState(false);
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    if (checkedLocalStorage) {
      localStorage.setItem(key, JSON.stringify(value));
    }
  }, [key, value, checkedLocalStorage]);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (saved !== null) {
      setValue(JSON.parse(saved) as T);
    }
    setCheckedLocalStorage(true);
  }, [key]);

  return [value, setValue];
}

function LoadingSpinner() {
  return (
    <div role="status">
      <svg
        aria-hidden="true"
        className="mr-2 w-8 h-8 text-gray-200 animate-spin dark:text-gray-600 fill-blue-300"
        viewBox="0 0 100 101"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
          fill="currentColor"
        />
        <path
          d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
          fill="currentFill"
        />
      </svg>
      <span className="sr-only">Loading...</span>
    </div>
  );
}

interface IChatMessage {
  id: string;
  parent_id: string | null;
  conversation_id: string;
  message: string;
  image_prompt: string | null;
}

interface IChatMessageOpenAI {
  parent_id: string | null;
  conversation_id: string;
  message: string;
}

function getStartingPrompt(input: string): string {
  return `
You are a text video game where you give me options (A, B, C, D) as my choices. Add a section before each choice describing the events as "Event". Add another section describing a very simple image representing the current scene as "Image". 

Here is an example output

Event: {event}

Image: {image description}

Options:
A: {option A}
B: {option B}
C: {option C}
D: {option D}

The scene is ${input}. I start out with 100 health. What is my first set of Event Image and options?
`;
}

export default function Home() {
  const [scene, setScene] = useLocalStorage("scene", "");
  const [chatHistory, setChatHistory] = useLocalStorage<IChatMessage[]>(
    "chatHistory",
    []
  );

  const [chatImageLookup, setChatImageLookup] = useLocalStorage<
    Record<string, string>
  >("chatImageLookup", {});

  const [loggedInDB, setLoggedInDb] = useLocalStorage<Record<string, boolean>>(
    "loggedInDB",
    {}
  );
  const [currentInput, setCurrentInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shifted, setShifted] = useState(false);

  useEffect(() => {
    window.scrollTo(0, document.body.scrollHeight);
  }, [chatHistory]);

  function extractImageData(prompt: string): string {
    const imgPrompt = prompt.split("Image: ")[1].split("\n")[0] as string;
    return imgPrompt;
  }
  async function getImageUrl(imagePrompt: string): Promise<string> {
    //sleep for 3 seconds
    await new Promise((r) => setTimeout(r, 8000));
    const { jobId: imageJobId } = await (
      await fetch("/api/queueImage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          input: {
            prompt: `Within the world of ${scene}, ${imagePrompt}`,
          },
        }),
      })
    ).json();
    const { url: image_url } = await (
      await fetch(`/api/imageResult`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId: imageJobId,
        }),
      })
    ).json();
    return image_url;
  }

  function cleanUpPrompt(prompt: string, imagePrompt: string): string {
    return prompt
      .replace(`Image: ${imagePrompt}`, "")
      .replace("Event: ", "")
      .replace("\n\n", "\n")
      .replace("\n\n", "\n");
  }

  async function requestPrompt(body: {
    prompt: string;
    conversation_id?: string;
    parent_id?: string;
  }): Promise<[IChatMessageOpenAI, string, string]> {
    const chatGPT3Data: IChatMessageOpenAI = await (
      await fetch("https://chatgpt.promptzero.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })
    ).json();

    const imagePrompt = extractImageData(chatGPT3Data.message);
    const messageWithoutImage = cleanUpPrompt(
      chatGPT3Data.message,
      imagePrompt
    );
    return [chatGPT3Data, imagePrompt, messageWithoutImage];
  }

  async function setImageFor(
    imagePrompt: string,
    requestId: string
  ): Promise<string> {
    return await getImageUrl(imagePrompt)
      .then((image_url) => {
        setChatImageLookup((prev) => ({ ...prev, [requestId]: image_url }));
        return image_url;
      })
      .catch((err) => {
        console.log("error getting image", err);
        return "";
      });
  }

  async function logCurrentSpot(
    {
      requestId,
      currentInput,
      imageUrl,
      imagePrompt,
      messageWithoutImage,
    }: {
      requestId: string;
      currentInput: string;
      imageUrl: string;
      imagePrompt: string;
      messageWithoutImage: string;
    },
    chatGPT3Data: IChatMessageOpenAI
  ) {
    const body: promptsDB = {
      id: requestId,
      input: currentInput,
      image_url: imageUrl,
      image_prompt: imagePrompt,
      response_without_image: messageWithoutImage,
      response_message: chatGPT3Data.message,
      last_id:
        chatHistory.length === 0
          ? null
          : chatHistory[chatHistory.length - 1].id,
      openai_parent_id: chatGPT3Data.parent_id,
      openai_conversation_id: chatGPT3Data.conversation_id,
    };
    await fetch("/api/log", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    setLoggedInDb((prev) => ({ ...prev, [requestId]: true }));
  }

  async function getResponse(): Promise<void> {
    const requestId = uuidv4();
    const [chatGPT3Data, imagePrompt, messageWithoutImage] =
      await requestPrompt({
        prompt: currentInput,
        conversation_id: chatHistory[chatHistory.length - 1].conversation_id,
        parent_id: chatHistory[chatHistory.length - 1].parent_id ?? undefined,
      });

    const displayedMessage = `You have choose "${currentInput}"\n\n${messageWithoutImage}`;

    setChatHistory((prev) => [
      ...prev,
      {
        ...chatGPT3Data,
        message: displayedMessage,
        image_prompt: imagePrompt,
        id: requestId,
        image_url: null,
      },
    ]);

    setImageFor(imagePrompt, requestId).then((imageUrl) => {
      logCurrentSpot(
        {
          requestId,
          currentInput,
          imageUrl,
          imagePrompt,
          messageWithoutImage: displayedMessage,
        },
        chatGPT3Data
      );
    });
  }
  async function getInitialResponse() {
    const requestId = uuidv4();
    const startingPrompt = getStartingPrompt(currentInput);
    const [chatGPT3Data, imagePrompt, messageWithoutImage] =
      await requestPrompt({
        prompt: startingPrompt,
      });
    setChatHistory([
      {
        ...chatGPT3Data,
        message: `${messageWithoutImage}`,
        image_prompt: imagePrompt,
        id: requestId,
      },
    ]);
    setImageFor(imagePrompt, requestId).then((imageUrl) => {
      logCurrentSpot(
        {
          requestId,
          currentInput,
          imageUrl,
          imagePrompt,
          messageWithoutImage,
        },
        chatGPT3Data
      );
    });
  }

  function submitRequestToBackend() {
    setIsLoading(true);
    setCurrentInput("");
    if (scene === "") {
      setScene(currentInput);

      getInitialResponse()
        .then(() => {
          setIsLoading(false);
        })
        .catch((e) => {
          setIsLoading(false);
          console.log("error", e);
          alert(
            "Error getting response.. Please note, " +
              "chatGPT API is not officially supported " +
              "and this is using a reversed engineered API.\n" +
              "Please try again later.\n\n See console for more details."
          );
        });
    } else {
      getResponse()
        .then(() => {
          setIsLoading(false);
        })
        .catch((e) => {
          setIsLoading(false);
          console.log("error", e);
          alert(
            "Error getting response.. Please note, " +
              "chatGPT API is not officially supported " +
              "and this is using a reversed engineered API.\n" +
              "Please try again later.\n\n See console for more details."
          );
        });
    }
  }
  function hasLocalStorage(): boolean {
    return scene !== "" || chatHistory.length > 0;
  }
  const router = useRouter();
  const { id } = router.query;

  if (id) {
    fetch("/api/history?id=" + id)
      .then((res) => res.json())
      .then((data: promptsDB[]) => {
        setScene(data[0].input);
        setChatHistory(
          data.map((item) => ({
            id: item.id,
            parent_id: item.openai_parent_id,
            conversation_id: item.openai_conversation_id,
            message: item.response_without_image,
            image_prompt: item.image_prompt,
          }))
        );
        setChatImageLookup(
          data.reduce((acc, item) => {
            acc[item.id] = item.image_url;
            return acc;
          }, {} as { [key: string]: string })
        );
        router.push("/", undefined, { shallow: true });

        console.log(data);
      });
    return (
      <div className="dark:bg-black dark:text-slate-200 h-screen flex flex-col gap-10 p-10">
        Loading... {id}
        <button
          onClick={() => {
            router.push("/", undefined, { shallow: true });
          }}
          className="w-1/2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Go Home
        </button>
      </div>
    );
  }

  if (
    !isLoading &&
    hasLocalStorage() &&
    (scene === "" || chatHistory.length === 0)
  ) {
    return (
      <div className="dark:bg-black dark:text-slate-200 h-screen flex flex-col gap-10 p-10">
        Loading...{" "}
        <p>
          If you are loading for a while (more than 5 seconds), the game is a in
          a weird state, please click this button to reset
        </p>
        <button
          onClick={() => {
            localStorage.clear();
            router.reload();
          }}
          className="w-1/2 bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Reset game
        </button>
      </div>
    );
  }

  return (
    <div className="dark:bg-black dark:text-slate-200">
      <Head>
        <title>AI Story Chat</title>
        <meta name="description" content="AI generated stories" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      {/* Make a text box that always stays on the bottom tailwind*/}
      <main className="flex flex-col w-full flex-1 text-center min-h-screen ">
        <h1 className="fixed top-0 text-center text-4xl font-bold w-full dark:bg-black bg-white py-5 border-b">
          {hasLocalStorage() ? (
            <div className="flex flex-row justify-between px-5 items-center">
              <div>{`Welcome to ${scene}`}</div>
              <button
                className="text-sm border p-3"
                onClick={() => {
                  setScene("");
                  setChatHistory([]);
                  setChatImageLookup({});
                }}
              >
                New game
              </button>
            </div>
          ) : (
            "AI Story Chat"
          )}
        </h1>
        <div className="flex flex-col-reverse w-full flex-1 text-center my-40 overflow-auto gap-5 justify-center items-center">
          {chatHistory
            .slice()
            .reverse()
            .map((chatMessage) => (
              <div
                key={chatMessage.id}
                className="flex flex-col w-5/6 whitespace-pre-wrap text-left border-2 p-5 justify-center items-center"
              >
                {chatImageLookup[chatMessage.id] === null ||
                chatImageLookup[chatMessage.id] === "" ||
                chatImageLookup[chatMessage.id] === undefined ? (
                  <div className="h-[500px] w-[500px] flex flex-col justify-center items-center">
                    <LoadingSpinner />
                  </div>
                ) : (
                  <img
                    src={chatImageLookup[chatMessage.id]}
                    width={500}
                    height={500}
                    alt={chatMessage.image_prompt ?? ""}
                  />
                )}
                <i className="text-xs my-2">{chatMessage.image_prompt}</i>

                <p>{chatMessage.message}</p>
                <div className="flex flex-row justify-end items-end w-full">
                  {loggedInDB[chatMessage.id] ? (
                    <div className="flex flex-row w-full justify-end mt-2">
                      <div className="flex flex-row gap-3">
                        <div
                          className="cursor-pointer"
                          onClick={() => {
                            navigator.clipboard.writeText(
                              `https://aistorychat.com?id=${chatMessage.id}`
                            );
                          }}
                        >
                          <BiCopy size={24} />
                        </div>
                        <a
                          href={`https://twitter.com/intent/tweet?text=${
                            `My new story about ${scene}! ` +
                            "https://aistorychat.com?id=" +
                            chatMessage.id
                          }`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <CiTwitter size={24} />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <LoadingSpinner />
                  )}
                </div>
              </div>
            ))}
        </div>
        <div className="fixed bottom-0 w-full pb-5 pt-2 dark:bg-black bg-white flex flex-col gap-3 justify-center items-center">
          <div className="flex flex-row justify-center gap-2 mx-auto w-full">
            <textarea
              disabled={isLoading}
              className="w-1/2 h-30 border-2 bg-transparent px-2 border-black dark:border-slate-200 resize-none"
              placeholder={
                scene === ""
                  ? "Enter the scene you want your story to take place. Ex (Harry Potter, Pokemon, Studio Ghibli) "
                  : isLoading
                  ? "Loading... this might take a while..."
                  : "Select one of the options and hit enter or the send button"
              }
              value={currentInput}
              onChange={(e) => setCurrentInput(e.target.value)}
              onKeyUp={(k) => {
                if (k.key === "Shift") {
                  setShifted(false);
                }
              }}
              onKeyDown={(k) => {
                if (k.key === "Shift") {
                  setShifted(true);
                } else if (k.key === "Enter" && !shifted) {
                  k.preventDefault();
                  submitRequestToBackend();
                }
              }}
            />
            <button
              disabled={isLoading}
              className="w-20 h-20 border-2 border-black dark:border-slate-200"
              onClick={() => {
                submitRequestToBackend();
              }}
            >
              {isLoading ? (
                <div className="flex flex-col justify-center items-center">
                  <LoadingSpinner />
                </div>
              ) : (
                "Send"
              )}
            </button>
          </div>
          <div className="flex flex-row gap-5">
            <a href="https://twitter.com/justinstorre">
              <i>twitter</i>
            </a>
            <a href="https://github.com/chitalian/aistorychat">
              <i>github</i>
            </a>
            <a href="https://discord.gg/E4mFcpneUd">
              <i>discord</i>
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
