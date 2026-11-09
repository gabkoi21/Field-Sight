import { useEffect, useRef, useState } from "react";
import { AlignLeft, Bold, Image, IndentDecrease, IndentIncrease, Italic, Link, List, ListOrdered, Pilcrow, Smile, Underline } from "lucide-react";

// Rebuild allowed markup so pasted or stored HTML cannot introduce executable content.
export function descriptionMarkup(value: string, allowImages = false): string {
  const source = document.createElement("div");
  if (!/<\/?[a-z][\s\S]*>/i.test(value)) {
    source.textContent = value;
    return source.innerHTML.replace(/\n/g, "<br>");
  }
  source.innerHTML = value;
  const allowed = new Set(["B", "STRONG", "I", "EM", "U", "P", "DIV", "BR", "H2", "H3", "UL", "OL", "LI", "BLOCKQUOTE", "A"]);
  if (allowImages) allowed.add("IMG");
  function clean(node: Node): Node {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? "");
    const fragment = document.createDocumentFragment();
    if (!(node instanceof HTMLElement) || ["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(node.tagName)) return fragment;
    const target = allowed.has(node.tagName) ? document.createElement(node.tagName.toLowerCase()) : fragment;
    if (target instanceof HTMLElement) {
      if (["left", "center", "right", "justify"].includes(node.style.textAlign)) target.style.textAlign = node.style.textAlign;
      if (/^\d+(px|em)$/.test(node.style.marginLeft)) target.style.marginLeft = node.style.marginLeft;
    }
    if (target instanceof HTMLImageElement) {
      const src = node.getAttribute("src") ?? "";
      if (!/^https:\/\//i.test(src)) return fragment;
      target.src = src;
      target.alt = node.getAttribute("alt") ?? "";
    }
    if (target instanceof HTMLAnchorElement) {
      const href = node.getAttribute("href") ?? "";
      if (/^(https?:\/\/|mailto:)/i.test(href)) target.setAttribute("href", href);
      target.setAttribute("rel", "noopener noreferrer");
    }
    node.childNodes.forEach(child => target.appendChild(clean(child)));
    return target;
  }
  const result = document.createElement("div");
  source.childNodes.forEach(child => result.appendChild(clean(child)));
  return result.innerHTML;
}

export function DescriptionEditor({ value, onChange, disabled, label = "Description", maxLength = 10000, allowImages = false, imageOnly = false }: { value: string; onChange: (value: string) => void; disabled: boolean; label?: string; maxLength?: number; allowImages?: boolean; imageOnly?: boolean }) {
  const editor = useRef<HTMLDivElement>(null);
  const selection = useRef<Range | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState("");
  const [active, setActive] = useState<string[]>([]);
  useEffect(() => {
    if (editor.current && editor.current.innerHTML !== value) editor.current.innerHTML = descriptionMarkup(value, allowImages);
  }, [value, disabled]);
  function remember() {
    const current = window.getSelection();
    if (current?.rangeCount && editor.current?.contains(current.anchorNode)) selection.current = current.getRangeAt(0).cloneRange();
    setActive(["bold", "italic", "underline", "insertOrderedList", "insertUnorderedList"].filter(command => document.queryCommandState?.(command)));
  }
  function commit() {
    if (!editor.current) return;
    let html = descriptionMarkup(editor.current.innerHTML, allowImages);
    if (imageOnly) {
      const content = document.createElement("div");
      content.innerHTML = html;
      html = Array.from(content.querySelectorAll("img")).map(image => image.outerHTML).join("");
    }
    if (html.length > maxLength) {
      editor.current.innerHTML = descriptionMarkup(value, allowImages);
      setError(`${label} must be ${maxLength.toLocaleString()} characters or fewer, including formatting.`);
      return;
    }
    setError("");
    onChange(editor.current.textContent?.trim() || editor.current.querySelector("img") ? html : "");
    remember();
  }
  function run(command: string, argument?: string) {
    if (disabled) return;
    editor.current?.focus();
    if (selection.current && editor.current?.contains(selection.current.commonAncestorContainer)) {
      const current = window.getSelection();
      current?.removeAllRanges();
      current?.addRange(selection.current);
    }
    document.execCommand(command, false, argument);
    commit();
  }
  const tools = [
    ["Bold", "bold", Bold], ["Italic", "italic", Italic], ["Underline", "underline", Underline],
    ["Numbered list", "insertOrderedList", ListOrdered], ["Bulleted list", "insertUnorderedList", List],
    ["Align left", "justifyLeft", AlignLeft], ["Decrease indent", "outdent", IndentDecrease], ["Increase indent", "indent", IndentIncrease],
  ] as const;
  const button = "inline-flex size-10 shrink-0 items-center justify-center rounded border-0 bg-transparent text-[#353d47] hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600";
  return <div className="overflow-hidden rounded border border-[var(--fs-control-border)] bg-white text-black focus-within:ring-2 focus-within:ring-blue-200">
    {!disabled && <div role="group" aria-label="Description formatting" className="flex flex-wrap items-center gap-0.5 border-b border-[#e6e8ed] bg-[#f7f7f8] px-2 py-1">
      {!imageOnly && tools.map(([label, command, Icon], index) => <span key={command} className="contents">
        {index === 3 && <select aria-label="Paragraph style" defaultValue="p" onFocus={remember} onChange={event => run("formatBlock", event.target.value)} className="h-10 rounded border-0 bg-transparent px-2 text-sm focus-visible:outline-blue-600"><option value="p">Normal</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option></select>}
        <button type="button" title={label} aria-label={label} aria-pressed={active.includes(command)} className={`${button} ${active.includes(command) ? "!bg-blue-100 !text-blue-700" : ""}`} onMouseDown={event => event.preventDefault()} onClick={() => run(command)}><Icon size={17} /></button>
      </span>)}
      <button type="button" aria-label="Paragraph" title="Paragraph" className={button} onMouseDown={event => event.preventDefault()} onClick={() => run("formatBlock", "p")}><Pilcrow size={17} /></button>
      <button type="button" aria-label="Insert link" title="Insert link" className={button} onMouseDown={event => event.preventDefault()} onClick={() => {
        const url = window.prompt("Link URL (https://, http:// or mailto:)");
        if (!url) return;
        if (!/^(https?:\/\/|mailto:)/i.test(url.trim())) { setError("Enter a link starting with https://, http:// or mailto:."); return; }
        run("createLink", url.trim());
      }}><Link size={17} /></button>
      <button type="button" aria-label="Insert emoji" title="Insert emoji" aria-expanded={emojiOpen} className={button} onMouseDown={event => event.preventDefault()} onClick={() => setEmojiOpen(!emojiOpen)}><Smile size={17} /></button>
      {emojiOpen && <div role="group" aria-label="Choose emoji" className="flex flex-wrap">{["🙂", "👍", "✅", "🎯", "📌", "🌍"].map(emoji => <button type="button" key={emoji} aria-label={`Insert ${emoji}`} className={button} onMouseDown={event => event.preventDefault()} onClick={() => { run("insertText", emoji); setEmojiOpen(false); }}>{emoji}</button>)}</div>}
      {allowImages && <button type="button" className={button} aria-label="Insert image" onMouseDown={event => event.preventDefault()} onClick={() => {
        const url = window.prompt("Image URL (https://)");
        if (!url) return;
        if (!/^https:\/\//i.test(url.trim())) { setError("Enter an image URL starting with https://."); return; }
        if (imageOnly && editor.current) editor.current.innerHTML = "";
        run("insertImage", url.trim());
      }}><Image size={17} /></button>}
    </div>}
    <div ref={editor} role="textbox" aria-label={label} aria-multiline="true" aria-readonly={disabled} contentEditable={!disabled} suppressContentEditableWarning tabIndex={disabled ? -1 : 0}
      className="min-h-32 break-words px-3 py-3 text-sm leading-6 outline-none [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:text-lg [&_h3]:font-semibold [&_a]:text-blue-700 [&_a]:underline [&_blockquote]:ml-6"
      onInput={commit} onMouseUp={remember} onKeyUp={remember} onBlur={remember}
      onPaste={event => { event.preventDefault(); run("insertText", event.clipboardData.getData("text/plain")); }} />
    {error && <p role="alert" className="m-0 px-3 pb-2 text-xs text-red-700">{error}</p>}
  </div>;
}
