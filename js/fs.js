/**
 * Halo OS Sandboxed Virtual File System (VFS)
 * Backed entirely by localStorage with absolute zero cloud telemetry.
 */
class VirtualFileSystem {
  constructor() {
    this.storageKey = 'halo_os_vfs';
    this.fs = {};
    this.init();
  }

  /**
   * Preloads default directory structures and explanatory readmes.
   */
  init() {
    const raw = localStorage.getItem(this.storageKey);
    if (raw) {
      try {
        this.fs = JSON.parse(raw);
        return;
      } catch (e) {
        console.error("VFS Corruption detected, resetting file system...", e);
      }
    }

    // Default System State Structure
    this.fs = {
      "/": { type: "dir", children: ["Desktop", "Documents", "Pictures", "Security"] },
      
      "/Desktop": { type: "dir", children: ["Welcome.txt", "Agent_Autostart.txt"] },
      "/Desktop/Welcome.txt": {
        type: "file",
        content: `=========================================
 WELCOME TO HALO PRIVACY SANDBOX OS
=========================================
This is a sovereign, agent-first operating system.
Key architecture stats:
- 100% Client-Side execution.
- localStorage persisted storage.
- No servers, no tracking, no data leakage.

Use the sidebar agent to navigate, build workflows,
and execute terminal routines. Try calling out:
"open notepad" or "run matrix rain".

Enjoy your secure workspace!`
      },
      "/Desktop/Agent_Autostart.txt": {
        type: "file",
        content: `// Agent Automation Autostart Config
// You can use the Automator App to compile and link these scripts.
// All keys are strictly sandboxed.
AGENT_ACTIVE=true
DEFAULT_PROMPT_SPEED=50ms
TELEMETRY_LOGGING=OFF`
      },

      "/Documents": { type: "dir", children: ["Zero_Telemetry_Declaration.txt", "API_Sandbox_Guide.txt"] },
      "/Documents/Zero_Telemetry_Declaration.txt": {
        type: "file",
        content: `ZERO-TELEMETRY COMPLIANCE CHARTER
--------------------------------
1. Absolute client-side data containment.
2. Local browser sandboxed variables are never shipped over outbound websockets or external HTTP packets.
3. Cookies are disabled; local VFS uses Isolated Sandboxed Keys.
4. User possesses unilateral keys authorization.
5. All security handshakes are audited client-side.`
      },
      "/Documents/API_Sandbox_Guide.txt": {
        type: "file",
        content: `CUSTOM API INTEGRATION STEPS
---------------------------
You can hook up a private Large Language Model endpoint (e.g. OpenAI, Anthropic, or a locally running Ollama instance) inside the 'API Keys' registry app.

To fetch locally using Ollama:
- Endpoint: http://localhost:11434/v1/chat/completions
- Model Name: llama3 or mistral
- API Key: (Optional for local)

The agent copilot will utilize this channel transparently without sending telemetry to our nodes.`
      },

      "/Pictures": { type: "dir", children: ["Cyberpunk_Core.png"] },
      "/Pictures/Cyberpunk_Core.png": {
        type: "file",
        content: "BASE64_SIMULATED_PNG_METADATA_ACCENT_STREAM"
      },

      "/Security": { type: "dir", children: ["Sandbox.log"] },
      "/Security/Sandbox.log": {
        type: "file",
        content: `[2026-05-24T15:55:00] [HALO_KERNEL] Sandboxed node mounted.
[2026-05-24T15:55:01] [SECURITY_CORE] Zero-Telemetry shield activated.
[2026-05-24T15:55:01] [NET_CORE] Outgoing HTTP sockets blocked.
[2026-05-24T15:55:02] [VFS_MNT] localStorage state persistent partition loaded: 3012 bytes used.`
      }
    };

    this.save();
  }

  /**
   * Save internal FS state to localStorage.
   */
  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.fs));
  }

  /**
   * Reads target file contents.
   */
  read(path) {
    const cleanPath = this.normalize(path);
    if (this.fs[cleanPath] && this.fs[cleanPath].type === 'file') {
      return this.fs[cleanPath].content;
    }
    return null;
  }

  /**
   * Writes content to a file, creating it if necessary.
   */
  write(path, content) {
    const cleanPath = this.normalize(path);
    const parts = this.splitPath(cleanPath);
    const parentPath = parts.parent;
    const name = parts.name;

    if (!this.fs[parentPath]) {
      this.mkdir(parentPath);
    }

    if (!this.fs[cleanPath]) {
      // Add to parent children
      if (!this.fs[parentPath].children.includes(name)) {
        this.fs[parentPath].children.push(name);
      }
    }

    this.fs[cleanPath] = {
      type: "file",
      content: content
    };

    this.save();
    this.logAction(`File Written: ${cleanPath}`);
    return true;
  }

  /**
   * Creates a directory.
   */
  mkdir(path) {
    const cleanPath = this.normalize(path);
    if (this.fs[cleanPath]) return false; // Already exists

    const parts = this.splitPath(cleanPath);
    const parentPath = parts.parent;
    const name = parts.name;

    if (parentPath !== "" && !this.fs[parentPath]) {
      this.mkdir(parentPath);
    }

    if (parentPath !== "" && this.fs[parentPath]) {
      if (!this.fs[parentPath].children.includes(name)) {
        this.fs[parentPath].children.push(name);
      }
    }

    this.fs[cleanPath] = {
      type: "dir",
      children: []
    };

    this.save();
    this.logAction(`Directory Created: ${cleanPath}`);
    return true;
  }

  /**
   * Deletes a file or directory recursively.
   */
  rm(path) {
    const cleanPath = this.normalize(path);
    if (cleanPath === "/" || !this.fs[cleanPath]) return false;

    const parts = this.splitPath(cleanPath);
    const parentPath = parts.parent;
    const name = parts.name;

    // Remove from parent children
    if (this.fs[parentPath]) {
      this.fs[parentPath].children = this.fs[parentPath].children.filter(c => c !== name);
    }

    // Delete sub-items recursively
    const keysToDelete = Object.keys(this.fs).filter(k => k === cleanPath || k.startsWith(cleanPath + "/"));
    keysToDelete.forEach(k => {
      delete this.fs[k];
    });

    this.save();
    this.logAction(`Item Removed: ${cleanPath}`);
    return true;
  }

  /**
   * Verify path existence.
   */
  exists(path) {
    const cleanPath = this.normalize(path);
    return !!this.fs[cleanPath];
  }

  /**
   * Lists folder contents.
   */
  ls(path) {
    const cleanPath = this.normalize(path);
    const node = this.fs[cleanPath];
    if (node && node.type === 'dir') {
      return node.children.map(name => {
        const itemPath = cleanPath === "/" ? `/${name}` : `${cleanPath}/${name}`;
        return {
          name: name,
          path: itemPath,
          type: this.fs[itemPath] ? this.fs[itemPath].type : 'file'
        };
      });
    }
    return [];
  }

  /**
   * Normalizes relative paths.
   */
  normalize(path) {
    if (!path.startsWith("/")) path = "/" + path;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    
    // Resolve relative dots (cd ..)
    const segments = path.split("/");
    const stack = [];
    for (const segment of segments) {
      if (segment === "" || segment === ".") continue;
      if (segment === "..") {
        if (stack.length > 0) stack.pop();
      } else {
        stack.push(segment);
      }
    }
    return "/" + stack.join("/");
  }

  /**
   * Helper to split parent directory from item name.
   */
  splitPath(path) {
    if (path === "/") return { parent: "", name: "" };
    const index = path.lastIndexOf("/");
    const parent = index === 0 ? "/" : path.substring(0, index);
    const name = path.substring(index + 1);
    return { parent, name };
  }

  /**
   * Rename / move a file or directory. Moves all nested children.
   * Returns true on success, false if source missing or target exists.
   */
  mv(from, to) {
    const src = this.normalize(from);
    const dst = this.normalize(to);
    if (!this.fs[src] || this.fs[dst] || src === '/' || dst === '/') return false;
    if (dst === src) return true;
    if (dst.startsWith(src + '/')) return false; // cannot move into self

    // Collect all keys to relocate (the node and any descendants)
    const movers = Object.keys(this.fs).filter(k => k === src || k.startsWith(src + '/'));

    // Detach from old parent
    const srcParts = this.splitPath(src);
    if (this.fs[srcParts.parent]) {
      this.fs[srcParts.parent].children = this.fs[srcParts.parent].children.filter(c => c !== srcParts.name);
    }
    // Attach to new parent (creating intermediate dirs if needed)
    const dstParts = this.splitPath(dst);
    if (!this.fs[dstParts.parent]) this.mkdir(dstParts.parent);
    if (!this.fs[dstParts.parent].children.includes(dstParts.name)) {
      this.fs[dstParts.parent].children.push(dstParts.name);
    }

    // Rewrite each key from src-prefix to dst-prefix
    movers.forEach(k => {
      const newKey = dst + k.slice(src.length);
      this.fs[newKey] = this.fs[k];
      delete this.fs[k];
    });

    this.save();
    this.logAction(`Moved: ${src} -> ${dst}`);
    return true;
  }

  /**
   * Push system audit logs inside /Security/Sandbox.log.
   * Writes the log entry directly (does NOT use this.write, which would recurse
   * back into logAction).
   */
  logAction(message) {
    const logPath = "/Security/Sandbox.log";
    let logs = this.read(logPath) || "";
    const timestamp = new Date().toISOString();
    logs += `\n[${timestamp}] [USER_ACTION] ${message}`;

    // Cap log lines to avoid localStorage saturation
    const lines = logs.split("\n");
    if (lines.length > 150) {
      logs = lines.slice(lines.length - 100).join("\n");
    }

    // Direct write to avoid logAction recursion
    if (!this.fs[logPath]) {
      const parts = this.splitPath(logPath);
      if (!this.fs[parts.parent]) this.mkdir(parts.parent);
      if (!this.fs[parts.parent].children.includes(parts.name)) {
        this.fs[parts.parent].children.push(parts.name);
      }
    }
    this.fs[logPath] = { type: "file", content: logs };
    this.save();
  }
}

export const VFS = new VirtualFileSystem();
export default VFS;
