import { isPdfAttachment } from "./attachment.js";
export function resolvePdfSelection(input) {
    if (input.selectedItem.kind === "attachment") {
        if (!isPdfAttachment(input.selectedItem)) {
            throw new Error("Selected attachment is not a PDF.");
        }
        return { attachment: input.selectedItem };
    }
    const attachment = input.selectedItem.attachments.find(isPdfAttachment);
    if (!attachment) {
        throw new Error("No PDF attachment found on the selected Zotero item.");
    }
    return {
        attachment,
        parentItemKey: input.selectedItem.key
    };
}
