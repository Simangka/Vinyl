VinylReader - Complete IDE with AI Agents System

═══════════════════════════════════════════════════
AGENTS BY ZIEGE - NEW FEATURE SECTION
═══════════════════════════════════════════════════

OVERVIEW:
Add a powerful AI agents system below the Code section and above Settings.
This section contains two main features:
1. **Chat Agent** - Multimodal chatbot with image support
2. **Agent Builder** - Visual workflow automation like n8n

UI LOCATION:
Left Sidebar Navigation (Updated):
- 📚 Library
- 🕐 Recent  
- 💻 Code (Workspace/File Explorer)
- 🤖 Agents by Ziege (NEW)
  - 💬 Chat Agent
  - 🔧 Agent Builder
- ⚙️ Settings

═══════════════════════════════════════════════════
1. CHAT AGENT - MULTIMODAL CHATBOT
═══════════════════════════════════════════════════

FEATURES:
- Full conversational AI interface
- Image upload and paste support (Ctrl+V)
- Multiple image attachments per message
- Conversation history per project/book
- Code syntax highlighting in responses
- File attachments (PDFs, text files)
- Export conversations
- Multiple chat sessions
- Model selection and configuration
- Vision capabilities for image analysis

CHAT AGENT UI DESIGN:
┌─ Chat Agent ──────────────────────────────────────────────────────┐
│ 💬 Chat Agent                          [New Chat] [Model: GPT-4o] │
├───────────────────────────────────────────────────────────────────┤
│ Sessions                                                          │
│ ▼ Today                                                           │
│   • Code debugging help                                           │
│   • Design review                                                 │
│ ▼ Yesterday                                                       │
│   • PDF analysis                                                  │
│ ▶ This Week                                                       │
├───────────────────────────────────────────────────────────────────┤
│ Current Chat: "Code debugging help"                    [•••]      │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 👤 You: Can you review this UI design?                     │ │
│ │                                                             │ │
│ │ [Image Attachment: screenshot.png]                         │ │
│ │ ┌─────────────────────┐                                    │ │
│ │ │  [Image Preview]    │                                    │ │
│ │ │                     │                                    │ │
│ │ └─────────────────────┘                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🤖 AI: I'll analyze the UI design in your screenshot.      │ │
│ │                                                             │ │
│ │ **Observations:**                                           │ │
│ │ 1. Clean dark theme with good contrast                     │ │
│ │ 2. Clear navigation hierarchy                              │ │
│ │ 3. Syntax highlighting is well implemented                 │ │
│ │                                                             │ │
│ │ **Suggestions:**                                            │ │
│ │ - Consider adding breadcrumbs for deep folder navigation   │ │
│ │ - The search bar could be more prominent                   │ │
│ │ - Add keyboard shortcut hints on hover                     │ │
│ │                                                             │ │
│ │ Would you like me to suggest specific color adjustments?   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ [Scroll for more...]                                             │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│ 📎 Attachments (2):                                               │
│ [📷 screenshot.png] [📄 design-spec.pdf]                         │
│                                                                   │
│ 💬 Type your message...                                          │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                                                             │ │
│ │                                                             │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ [📎 Attach] [🖼️ Paste Image] [💾 Save Chat]           [Send] │
└───────────────────────────────────────────────────────────────────┘

CHAT AGENT FEATURES IN DETAIL:

**Image Support:**
- Drag and drop images directly into chat
- Paste from clipboard (Ctrl+V)
- Upload via file picker
- Support formats: PNG, JPG, WEBP, GIF
- Image preview before sending
- Multiple images per message (up to 5)
- Image thumbnails in chat history
- Click to view full size
- Download/save images from chat

**File Attachments:**
- Attach PDFs, text files, code files
- AI can read and analyze file contents
- Show file name, size, type
- Preview for supported formats
- Remove attachment before sending

**Message Features:**
- Markdown rendering in messages
- Code blocks with syntax highlighting
- Copy code button
- Edit your previous messages
- Regenerate AI responses
- Delete messages
- Star/bookmark important messages

**Session Management:**
- Create new chat sessions
- Rename sessions
- Delete sessions
- Search across all sessions
- Export session as markdown/JSON
- Group sessions by date
- Pin important sessions
- Session templates (coding help, design review, etc.)

**Context Awareness:**
- Can reference open files in workspace
- Can access highlighted text from books
- Can reference previous conversations
- Include current file context automatically

**Quick Actions Bar:**
┌─ Quick Actions ──────────────────────┐
│ 💡 Explain Code                      │
│ 🐛 Debug Error                       │
│ ✨ Improve Code                      │
│ 📝 Generate Docs                     │
│ 🎨 Design Review                     │
│ 📊 Analyze Image                     │
│ 🔍 Code Review                       │
└──────────────────────────────────────┘

═══════════════════════════════════════════════════
2. AGENT BUILDER - VISUAL WORKFLOW AUTOMATION
═══════════════════════════════════════════════════

CONCEPT:
A visual node-based editor like n8n for creating automated AI workflows.
Users can build complex automation pipelines by connecting nodes.

AGENT BUILDER UI DESIGN:
┌─ Agent Builder ───────────────────────────────────────────────────┐
│ 🔧 Agent Builder                    [Save] [Run] [Deploy] [•••]   │
├───────────────────────────────────────────────────────────────────┤
│ My Workflows │ Templates │ Gallery                                │
├──────────────┴───────────────────────────────────────────────┬────┤
│ ▼ My Workflows                                              │Node│
│   • Book Summarizer                                         │Lib │
│   • Code Review Bot                                         │    │
│   • Image Analyzer                                          │📥  │
│   • PDF Processor                                           │In  │
│ ▶ Templates                                                 │    │
│ ▶ Community                                                 │🔄  │
├─────────────────────────────────────────────────────────────┤Pro │
│                                                             │    │
│              CANVAS AREA (Visual Editor)                    │🤖  │
│                                                             │AI  │
│  ┌──────────┐         ┌──────────┐        ┌──────────┐   │    │
│  │  📥 PDF  │────────▶│  🤖 AI   │───────▶│  💾 Save │   │📤  │
│  │  Input   │         │ Analyze  │        │  Output  │   │Out │
│  └──────────┘         └──────────┘        └──────────┘   │    │
│       │                                                    │⚙️  │
│       │              ┌──────────┐                         │Set │
│       └─────────────▶│  📊 Log  │                         │    │
│                      │  Status  │                         │🔗  │
│                      └──────────┘                         │API │
│                                                            │    │
│  [Canvas tools: Zoom, Pan, Align, Auto-layout]            │    │
├─────────────────────────────────────────────────────────────┴────┤
│ Workflow: "Book Summarizer"  │  Status: ⏸️ Stopped  │  Runs: 45  │
└───────────────────────────────────────────────────────────────────┘

AGENT BUILDER COMPONENTS:

**1. Canvas:**
- Infinite scrollable workspace
- Zoom in/out (10% - 200%)
- Pan with middle mouse or space+drag
- Grid snapping (optional)
- Multi-select nodes
- Undo/redo (Ctrl+Z, Ctrl+Y)
- Copy/paste nodes
- Align tools
- Auto-layout algorithms

**2. Node Library (Right Sidebar):**

**Input Nodes:**
- 📥 File Input (PDF, EPUB, TXT, Images)
- 📥 Text Input (manual text entry)
- 📥 Clipboard (read from clipboard)
- 📥 Workspace File (select from workspace)
- 📥 Book Content (from library)
- 📥 Web Scraper (URL input)
- 📥 API Request (HTTP input)
- 📥 Database Query
- 📥 Schedule Trigger (cron jobs)

**Processing Nodes:**
- 🤖 AI Chat (general conversation)
- 🤖 AI Vision (image analysis)
- 🤖 AI Code Generator
- 🤖 AI Summarizer
- 🤖 AI Translator
- 🔄 Text Transform (regex, replace, format)
- 🔄 JSON Parser
- 🔄 Data Filter
- 🔄 Split/Merge
- 🔄 Loop (iterate over items)
- 🔄 Conditional (if/else logic)
- 🔄 Delay/Wait
- 🔄 Code Execution (JS/Python)

**Output Nodes:**
- 💾 Save to File
- 💾 Save to Workspace
- 💾 Save to Database
- 📧 Send Email
- 📱 Notification
- 📊 Log/Console
- 📤 HTTP Response
- 📤 Webhook
- 📤 Export (multiple formats)

**Integration Nodes:**
- 🔗 OpenAI API
- 🔗 Anthropic API
- 🔗 Google Drive
- 🔗 GitHub
- 🔗 Notion
- 🔗 Slack
- 🔗 Discord
- 🔗 Custom API

**Utility Nodes:**
- ⚙️ Variables (store/retrieve)
- ⚙️ Function (custom logic)
- ⚙️ Error Handler
- ⚙️ Merge (combine branches)
- ⚙️ Split (branch workflow)
- ⚙️ Counter
- ⚙️ Timer

**3. Node Configuration Panel:**
When a node is selected:
┌─ Node Settings ───────────────────┐
│ 🤖 AI Summarizer                  │
│                                   │
│ Name:                             │
│ [Book Summary Generator]          │
│                                   │
│ Model:                            │
│ [gpt-4o ▼]                        │
│                                   │
│ Prompt Template:                  │
│ ┌─────────────────────────────┐  │
│ │ Summarize the following     │  │
│ │ book content in 3-5         │  │
│ │ paragraphs:                 │  │
│ │                             │  │
│ │ {{input.content}}           │  │
│ └─────────────────────────────┘  │
│                                   │
│ Max Length: [500] tokens          │
│ Temperature: [0.7]                │
│                                   │
│ ☑ Stream response                │
│ ☐ Include citations              │
│                                   │
│ Advanced Options ▼                │
│                                   │
│ [Test Node] [Delete]              │
└───────────────────────────────────┘

**4. Connection System:**
- Drag from output port to input port
- Colored connections by data type:
  - Blue: Text/String
  - Green: File/Binary
  - Orange: Number
  - Purple: Object/JSON
  - Red: Error
- Animated flow during execution
- Breakpoints on connections
- View data passing through connections
- Conditional connections

**5. Workflow Templates:**

**Template: Book Summarizer**