I want to be able to schedule notes.

In order to do that, we need to have 3 functions.

1. **Create schedule:**
Params:
scheduleId(string), timestamp (number)

What does it do?
1. It sets a schedule that will be trigerred, if the user is in writeroom.co/writestack/substack.com.
2. The schedule will contain the data:
{
scheduleId: string,
userId: string,
timestamp: string,
}

2. **Delete schedule:**

Params:
scheduleId(string)

What does it do?
1. It deletes the schedule from the chrome.storage.

3. **Get schedules:**

Params:

What does it do?
1. It gets all the schedules from the chrome.storage.
2. It returns an array of schedules ({scheduleId: string, timestamp: string})

--
# Schedule Trigger

Now, for the actual implementation of schedule trigger.

Once a schedule has been triggered, here's what happens:

1. Send a GET request to https://wwww.writestack.io/api/v1/schedule/{scheduleId}, with the following body:
{
scheduleId: string,
timestamp: string,
}
The api will return the following response: 
{
    jsonBody: any,
    attachmentUrls: string[],
}
1. If jsonBody is empty, send a POST request to https://wwww.writestack.io/api/v1/schedule/{scheduleId}/triggered, with the following body:
{
    ok: false,
    error: "EMPTY_BODY",
}
1. If attachmentUrls is not empty, we need to upload the files to the Substack server. Here's how we do it:
   ``` javascript
   export interface NoteDraftImage {
    id: string;
    url: string;
    }
   export async function prepareAttachmentsForNote(
    urls: string[]
    ): Promise<NoteDraftImage[]> {
    const maxAttachments = 4;
    if (!note) {
        throw new NoteNotFoundError("Note not found");
    }

    let attachments: NoteDraftImage[] = [];
    const attachmentsToUpload = urls.slice(0, maxAttachments);


    for (const url of attachmentsToUpload) {
        const buffer = await downloadImage({
        s3Url: url,
        });
        const substackImage = await uploadImageSubstack(buffer, {
        userId: note.userId,
        noteId: noteId,
        s3AttachmentId: attachment.id,
        });
        attachments.push(substackImage);
    }

    return attachments;
    }

   export async function downloadImage(
    url: string
    ): Promise<Buffer | null> {
        const response = await fetch(url);
        if (!response.ok) {
            const responseText = await response.text();
            console.error(`Failed to fetch image from ${url}, got status: ${response.status}, response: ${responseText}`);
            return null;
        }

        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    }
    export async function uploadImageSubstack(
        image: Buffer | string,
        params: {
            userId: string;
            noteId: string;
            s3AttachmentId: string;
        },
        ): Promise<NoteDraftImage> {
        const base64 = image.toString("base64");
        const dataUri = `data:image/png;base64,${base64}`;

        const note = await prisma.note.findUnique({
            where: {
            id: params.noteId,
            },
        });

        if (!note) {
            throw new NoteNotFoundError("Note not found");
        }

        const uploadImageRespone = await fetch("https://substack.com/api/v1/image", {
            headers: {
            "Content-Type": "application/json",
            Referer: "https://substack.com/home",
            "Referrer-Policy": "strict-origin-when-cross-origin",
            },
            body: JSON.stringify({ image: dataUri }),
            method: "POST",
        });

        if (!uploadImageRespone.ok) {
            throw new FailedToUploadImageError("Failed to upload image");
        }

        const data = await uploadImageRespone.json();

        // payload: {type: "image", url: `${url}`}
        const getImageResponse = await fetch(
            "https://substack.com/api/v1/comment/attachment",
            {
            headers: {
                "Content-Type": "application/json",
                Referer: "https://substack.com/home",
                "Referrer-Policy": "strict-origin-when-cross-origin",
            },
            method: "POST",
            body: JSON.stringify({ type: "image", url: data.url }),
            },
        );

        if (!getImageResponse.ok) {
            throw new FailedToUploadImageError("Failed to upload image");
        }

        const imageData: SubstackImageResponse = await getImageResponse.json();

        const substackImage = await prisma.substackImage.create({
            data: {
            noteId: params.noteId,
            imageId: imageData.id,
            imageUrl: imageData.imageUrl,
            imageWidth: imageData.imageWidth,
            imageHeight: imageData.imageHeight,
            explicit: imageData.explicit,
            s3AttachmentId: params.s3AttachmentId,
            },
        });

        const response: NoteDraftImage = {
            id: substackImage.imageId,
            url: substackImage.imageUrl,
        };

        return response;
        }
   ```
   ## Note: For creating substackImage, send POST to: https://substack.com/api/v1/note/substack-image
4. Now that we have a note, see createSubstackPost in background.ts to send the note to substack.
5. If the note is created successfully, send a POST request to https://wwww.writestack.io/api/v1/schedule/{scheduleId}/triggered, with the following body:
{
    scheduleId: string,
    timestamp: string,
    ok: true,
}
6. If the note is not created successfully, send a POST request to https://wwww.writestack.io/api/v1/schedule/{scheduleId}/triggered, with the following body:
{
    scheduleId: string,
    timestamp: string,
    ok: false,
    error: "FAILED_TO_CREATE_NOTE",
    text: response.text,
}


