const form = document.querySelector("#chat-form");
const questionInput = document.querySelector("#question");
const sendButton = document.querySelector("#send-button");
const messages = document.querySelector("#messages");
const welcome = document.querySelector("#welcome");
const clearButton = document.querySelector("#clear-chat");

// Keep recent turns so short follow-ups like "yes" have context.
let conversation = [];

function normalizeMarkdown(text) {
  return String(text)
    // Decode common HTML entities that occasionally leak into model output.
    .replace(/&(?:#x([0-9a-f]+)|#([0-9]+)|(amp|lt|gt|quot|apos|nbsp));/gi, (entity, hex, dec, named) => {
      if (hex) return String.fromCodePoint(parseInt(hex, 16));
      if (dec) return String.fromCodePoint(parseInt(dec, 10));
      return ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " })[named.toLowerCase()] ?? entity;
    })
    // Render common math as readable text instead of exposing raw LaTeX.
    .replace(/\$\$([\s\S]*?)\$\$/g, (_, formula) => formula
      .replace(/\\text\{([^{}]*)\}/g, "$1")
      .replace(/\\times/g, "×")
      .replace(/\\cdot/g, "·")
      .replace(/\\left|\\right/g, "")
      .replace(/[{}]/g, "")
      .replace(/\\,/g, " ")
      .replace(/\s+/g, " ")
      .trim())
    .replace(/\$([^$\n]+)\$/g, "$1")
    // Some model responses escape Markdown punctuation; unescape it for display.
    .replace(/\\([\\`*_{}\[\]()#+\-.!|>~])/g, "$1")
    // Remove Markdown hard-break backslashes at the end of a line.
    .replace(/\\[ \t]*\n/g, "\n");
}

function renderInline(text, parent) {
  const pattern = /(\[[^\]]+\]\(https?:\/\/[^\s)]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_)/g;
  let cursor = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > cursor) {
      parent.appendChild(document.createTextNode(text.slice(cursor, match.index)));
    }
    const token = match[0];
    let element;
    if (token.startsWith("[")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (linkMatch) {
        element = document.createElement("a");
        element.textContent = linkMatch[1];
        element.href = linkMatch[2];
        element.target = "_blank";
        element.rel = "noopener noreferrer";
      }
    } else if (token.startsWith("`")) {
      element = document.createElement("code");
      element.textContent = token.slice(1, -1);
    } else if (token.startsWith("**") || token.startsWith("__")) {
      element = document.createElement("strong");
      element.textContent = token.slice(2, -2);
    } else if (token.startsWith("~~")) {
      element = document.createElement("del");
      element.textContent = token.slice(2, -2);
    } else {
      element = document.createElement("em");
      element.textContent = token.slice(1, -1);
    }
    if (element) parent.appendChild(element);
    else parent.appendChild(document.createTextNode(token));
    cursor = match.index + token.length;
  }
  if (cursor < text.length) {
    parent.appendChild(document.createTextNode(text.slice(cursor)));
  }
}

function renderMarkdown(rawText, container) {
  const text = normalizeMarkdown(rawText).replace(/\r\n/g, "\n");
  const lines = text.split("\n");
  let i = 0;

  const isTableDivider = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const isTableRow = (line) => line.includes("|") && line.trim().startsWith("|");
  const cellsFrom = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
  const isList = (line) => /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    if (/^\s*```/.test(line)) {
      const opening = line.trim().slice(3).trim();
      const codeLines = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) codeLines.push(lines[i++]);
      if (i < lines.length) i++;
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      if (opening) code.className = `language-${opening.replace(/[^a-zA-Z0-9_-]/g, "")}`;
      code.textContent = codeLines.join("\n");
      pre.appendChild(code);
      container.appendChild(pre);
      continue;
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      const h = document.createElement(`h${heading[1].length}`);
      renderInline(heading[2], h);
      container.appendChild(h);
      i++;
      continue;
    }

    if (/^\s*(?:---+|___+|\*\s*\*\s*\*\s*)$/.test(line)) {
      container.appendChild(document.createElement("hr"));
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isTableDivider(lines[i + 1])) {
      const headers = cellsFrom(line);
      const table = document.createElement("table");
      const thead = document.createElement("thead");
      const headerRow = document.createElement("tr");
      headers.forEach((value) => {
        const th = document.createElement("th");
        renderInline(value, th);
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      i += 2;
      const tbody = document.createElement("tbody");
      while (i < lines.length && isTableRow(lines[i])) {
        const row = document.createElement("tr");
        cellsFrom(lines[i++]).forEach((value) => {
          const td = document.createElement("td");
          renderInline(value, td);
          row.appendChild(td);
        });
        tbody.appendChild(row);
      }
      table.appendChild(tbody);
      const tableWrap = document.createElement("div");
      tableWrap.className = "table-wrap";
      tableWrap.appendChild(table);
      container.appendChild(tableWrap);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = document.createElement("blockquote");
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        const p = document.createElement("p");
        renderInline(lines[i++].replace(/^\s*>\s?/, ""), p);
        quote.appendChild(p);
      }
      container.appendChild(quote);
      continue;
    }

    if (isList(line)) {
      const ordered = /^\s*\d+[.)]\s+/.test(line);
      const list = document.createElement(ordered ? "ol" : "ul");
      while (i < lines.length && isList(lines[i]) && /^\s*\d+[.)]\s+/.test(lines[i]) === ordered) {
        const item = document.createElement("li");
        const content = lines[i++].replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "");
        renderInline(content, item);
        list.appendChild(item);
      }
      container.appendChild(list);
      continue;
    }

    const paragraphLines = [];
    while (i < lines.length && lines[i].trim() &&
      !/^\s*```/.test(lines[i]) &&
      !/^\s{0,3}#{1,6}\s+/.test(lines[i]) &&
      !isList(lines[i]) &&
      !/^\s*>\s?/.test(lines[i]) &&
      !(isTableRow(lines[i]) && i + 1 < lines.length && isTableDivider(lines[i + 1])) &&
      !/^\s*(?:---+|___+|\*\s*\*\s*\*\s*)$/.test(lines[i])) {
      paragraphLines.push(lines[i++]);
    }
    const paragraph = document.createElement("p");
    renderInline(paragraphLines.join(" "), paragraph);
    container.appendChild(paragraph);
  }
}

function addMessage(role, text) {
  const wrapper = document.createElement("article");
  wrapper.className = `message ${role}`;

  const avatar = document.createElement("div");
  avatar.className = "avatar";
  avatar.textContent = role === "user" ? "YOU" : "AI";

  const body = document.createElement("div");
  body.className = "message-body";
  if (role === "assistant") renderMarkdown(text, body);
  else body.textContent = text;

  wrapper.append(avatar, body);
  messages.appendChild(wrapper);
  wrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return wrapper;
}

function showTyping() {
  const wrapper = document.createElement("article");
  wrapper.className = "message assistant";
  wrapper.innerHTML = '<div class="avatar">AI</div><div class="message-body"><div class="typing" aria-label="Thinking"><span></span><span></span><span></span></div></div>';
  messages.appendChild(wrapper);
  wrapper.scrollIntoView({ behavior: "smooth", block: "nearest" });
  return wrapper;
}

async function askQuestion(question) {
  const trimmed = question.trim();
  if (!trimmed || sendButton.disabled) return;

  welcome.hidden = true;
  addMessage("user", trimmed);
  conversation.push({ role: "user", text: trimmed });
  questionInput.value = "";
  questionInput.style.height = "auto";
  sendButton.disabled = true;
  questionInput.disabled = true;
  const typing = showTyping();

  try {
    const history = conversation.slice(-20);
    if (history[0]?.role === "assistant") history.shift();
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history })
    });
    const data = await response.json();
    typing.remove();

    if (!response.ok) throw new Error(data.error || "Something went wrong.");
    addMessage("assistant", data.answer);
    conversation.push({ role: "assistant", text: data.answer });
    conversation = conversation.slice(-20);
    if (conversation[0]?.role === "assistant") conversation.shift();
  } catch (error) {
    typing.remove();
    // Don't send a failed, unanswered turn as if it were part of the conversation.
    if (conversation.at(-1)?.role === "user" && conversation.at(-1)?.text === trimmed) {
      conversation.pop();
    }
    addMessage("assistant", `**Sorry, I couldn't answer that.**\n\n${error.message}`);
  } finally {
    sendButton.disabled = false;
    questionInput.disabled = false;
    questionInput.focus();
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  askQuestion(questionInput.value);
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => askQuestion(button.dataset.prompt));
});

clearButton.addEventListener("click", () => {
  messages.replaceChildren();
  conversation = [];
  welcome.hidden = false;
  questionInput.focus();
});

questionInput.addEventListener("input", () => {
  questionInput.style.height = "auto";
  questionInput.style.height = `${Math.min(questionInput.scrollHeight, 150)}px`;
});

questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});
