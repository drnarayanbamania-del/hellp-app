// Hello App - Main Application
import insforge from './insforge.js'
import { icons } from './icons.js'
import {
  formatTime, formatDate, getInitials,
  stringToColor, showToast, autoResize, escapeHtml, debounce
} from './utils.js'

// =============================================
// APP STATE
// =============================================
const state = {
  currentUser: null,
  currentProfile: null,
  conversations: [],
  activeConversation: null,
  messages: [],
  allUsers: [],
  realtimeConnected: false,
  isMobile: window.innerWidth <= 768,
}

// =============================================
// MAIN ENTRY
// =============================================
async function init() {
  renderLoading()

  // Handle OAuth callback (insforge_code in URL after Google/GitHub redirect)
  const urlParams = new URLSearchParams(window.location.search)
  const oauthCode = urlParams.get('insforge_code')
  if (oauthCode) {
    // Clean URL without reloading
    window.history.replaceState({}, document.title, window.location.pathname)
    try {
      const { data, error } = await insforge.auth.exchangeOAuthCode(oauthCode)
      if (!error && data?.user) {
        state.currentUser = data.user
        await createProfileIfNeeded(data.user.name || data.user.email?.split('@')[0] || 'User')
        renderApp()
        return
      }
    } catch {}
  }

  try {
    const { data } = await insforge.auth.getCurrentUser()
    if (data?.user) {
      state.currentUser = data.user
      await loadProfile()
      renderApp()
    } else {
      renderAuth()
    }
  } catch {
    renderAuth()
  }
}

// =============================================
// LOADING SCREEN
// =============================================
function renderLoading() {
  document.getElementById('app').innerHTML = `
    <div class="loading-screen">
      <div class="spinner lg"></div>
      <p style="color:var(--wa-text-secondary);font-size:14px;">Connecting...</p>
    </div>
  `
}

// =============================================
// AUTH PAGE
// =============================================
function renderAuth(mode = 'login') {
  document.getElementById('app').innerHTML = `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-logo">
          <div class="auth-logo-icon">
            ${icons.whatsapp}
          </div>
          <h1>Hello App</h1>
          <p>Connect. Share. Belong.</p>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab ${mode === 'login' ? 'active' : ''}" id="tab-login" onclick="switchAuthTab('login')">Sign In</button>
          <button class="auth-tab ${mode === 'signup' ? 'active' : ''}" id="tab-signup" onclick="switchAuthTab('signup')">Sign Up</button>
        </div>

        <div id="auth-content">
          ${mode === 'login' ? renderLoginForm() : renderSignupForm()}
        </div>
      </div>
    </div>
  `
}

function renderLoginForm(error = '') {
  return `
    <form class="auth-form" id="login-form" onsubmit="handleLogin(event)">
      ${error ? `<div class="error-message">${escapeHtml(error)}</div>` : ''}
      <div class="form-group">
        <label>Email</label>
        <input id="login-email" type="email" class="form-input" placeholder="you@example.com" required autocomplete="email" />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input id="login-password" type="password" class="form-input" placeholder="••••••••" required autocomplete="current-password" minlength="6" />
      </div>
      <button type="submit" class="btn-primary" id="login-btn">Sign In</button>

      <div class="divider">or continue with</div>
      <div class="oauth-btns">
        <button type="button" class="btn-oauth google-btn" onclick="handleOAuth('google')">
          ${icons.google} Google
        </button>
        <button type="button" class="btn-oauth github-btn" onclick="handleOAuth('github')">
          ${icons.github} GitHub
        </button>
      </div>
    </form>
  `
}

function renderSignupForm(error = '') {
  return `
    <form class="auth-form" id="signup-form" onsubmit="handleSignup(event)">
      ${error ? `<div class="error-message">${escapeHtml(error)}</div>` : ''}
      <div class="form-group">
        <label>Name</label>
        <input id="signup-name" type="text" class="form-input" placeholder="Your full name" required autocomplete="name" />
      </div>
      <div class="form-group">
        <label>Email</label>
        <input id="signup-email" type="email" class="form-input" placeholder="you@example.com" required autocomplete="email" />
      </div>
      <div class="form-group">
        <label>Password</label>
        <input id="signup-password" type="password" class="form-input" placeholder="Min. 6 characters" required minlength="6" autocomplete="new-password" />
      </div>
      <button type="submit" class="btn-primary" id="signup-btn">Create Account</button>

      <div class="divider">or continue with</div>
      <div class="oauth-btns">
        <button type="button" class="btn-oauth" onclick="handleOAuth('google')">
          ${icons.google} Google
        </button>
        <button type="button" class="btn-oauth" onclick="handleOAuth('github')">
          ${icons.github} GitHub
        </button>
      </div>
    </form>
  `
}

function renderVerifyForm(email) {
  return `
    <div class="verify-container">
      <div class="auth-logo-icon" style="margin:0 auto 16px; width:56px; height:56px;">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="white"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
      </div>
      <h3 style="font-size:18px; font-weight:600; color:var(--wa-text); margin-bottom:8px;">Check your email</h3>
      <p style="font-size:14px; color:var(--wa-text-secondary); margin-bottom:4px;">We sent a 6-digit code to</p>
      <p style="font-size:14px; color:var(--wa-green); font-weight:500; margin-bottom:24px;">${escapeHtml(email)}</p>
      <div id="verify-error"></div>
      <div class="verify-code-inputs" id="verify-inputs">
        ${[0,1,2,3,4,5].map(i => `<input class="verify-digit" id="vd-${i}" type="text" maxlength="1" pattern="[0-9]" data-index="${i}" inputmode="numeric" />`).join('')}
      </div>
      <button class="btn-primary" id="verify-btn" onclick="handleVerify('${escapeHtml(email)}')">Verify</button>
      <p style="font-size:13px; color:var(--wa-text-secondary); margin-top:16px;">
        Didn't receive it?
        <span onclick="handleResendCode('${escapeHtml(email)}')" style="color:var(--wa-green);cursor:pointer;font-weight:500;">Resend</span>
      </p>
    </div>
  `
}

// =============================================
// AUTH HANDLERS (global)
// =============================================
window.switchAuthTab = (mode) => {
  document.getElementById('auth-content').innerHTML =
    mode === 'login' ? renderLoginForm() : renderSignupForm()
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'))
  document.getElementById(`tab-${mode}`)?.classList.add('active')
  window._authMode = mode
}
window._authMode = 'login'

window.handleLogin = async (e) => {
  e.preventDefault()
  const email = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value
  const btn = document.getElementById('login-btn')

  btn.disabled = true
  btn.textContent = 'Signing in...'

  const { data, error } = await insforge.auth.signInWithPassword({ email, password })

  if (error) {
    btn.disabled = false
    btn.textContent = 'Sign In'
    document.getElementById('auth-content').innerHTML = renderLoginForm(
      error.statusCode === 403 ? 'Email not verified. Check your inbox.' : error.message
    )
    return
  }

  state.currentUser = data.user
  await loadProfile()
  renderApp()
}

window.handleSignup = async (e) => {
  e.preventDefault()
  const name = document.getElementById('signup-name').value.trim()
  const email = document.getElementById('signup-email').value.trim()
  const password = document.getElementById('signup-password').value
  const btn = document.getElementById('signup-btn')

  btn.disabled = true
  btn.textContent = 'Creating account...'

  const { data, error } = await insforge.auth.signUp({
    email, password, name,
    redirectTo: window.location.origin
  })

  if (error) {
    btn.disabled = false
    btn.textContent = 'Create Account'
    document.getElementById('auth-content').innerHTML = renderSignupForm(error.message)
    return
  }

  if (data?.requireEmailVerification) {
    document.getElementById('auth-content').innerHTML = renderVerifyForm(email)
    setTimeout(setupVerifyInputs, 50)
  } else if (data?.accessToken) {
    state.currentUser = data.user
    await createProfileIfNeeded(name)
    renderApp()
  }
}

function setupVerifyInputs() {
  const inputs = document.querySelectorAll('.verify-digit')
  inputs.forEach((input, i) => {
    input.addEventListener('input', (e) => {
      const v = e.target.value.replace(/\D/g, '')
      e.target.value = v
      if (v && i < inputs.length - 1) inputs[i + 1].focus()
    })
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !e.target.value && i > 0) inputs[i - 1].focus()
    })
    input.addEventListener('paste', (e) => {
      e.preventDefault()
      const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
      pasted.split('').forEach((ch, j) => {
        if (inputs[j]) inputs[j].value = ch
      })
      inputs[Math.min(pasted.length, 5)].focus()
    })
  })
  inputs[0]?.focus()
}

window.handleVerify = async (email) => {
  const otp = [...document.querySelectorAll('.verify-digit')].map(el => el.value).join('')
  if (otp.length < 6) {
    showToast('Please enter the complete 6-digit code.', 'error')
    return
  }

  const btn = document.getElementById('verify-btn')
  btn.disabled = true
  btn.textContent = 'Verifying...'

  const { data, error } = await insforge.auth.verifyEmail({ email, otp })

  if (error) {
    btn.disabled = false
    btn.textContent = 'Verify'
    document.getElementById('verify-error').innerHTML =
      `<div class="error-message" style="margin-bottom:12px;">${escapeHtml(error.message || 'Invalid or expired code.')}</div>`
    return
  }

  state.currentUser = data.user
  await createProfileIfNeeded(data.user.name || email.split('@')[0])
  renderApp()
}

window.handleResendCode = async (email) => {
  await insforge.auth.resendVerificationEmail({ email, redirectTo: window.location.origin })
  showToast('Verification code resent!', 'success')
}

window.handleOAuth = async (provider) => {
  const buttons = document.querySelectorAll('.btn-oauth')
  const btn = [...buttons].find(b => b.textContent.toLowerCase().includes(provider))
  const originalHTML = btn?.innerHTML

  if (btn) {
    btn.disabled = true
    btn.classList.add('loading')
    btn.innerHTML = `<div class="spinner" style="width:16px;height:16px;border-width:2px;margin-right:8px;display:inline-block;vertical-align:middle;"></div> Connecting...`
  }

  // Retry up to 2 times for intermittent backend slowness
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log(`[OAuth] Attempt ${attempt} for ${provider}`)
      const { data, error } = await insforge.auth.signInWithOAuth({
        provider,
        redirectTo: window.location.origin,
      })

      console.log(`[OAuth] Response:`, { data, error })

      if (error) {
        if (attempt < 2) {
          console.warn(`[OAuth] Error on attempt ${attempt}, retrying...`, error)
          continue
        }
        showToast(`${provider} sign-in failed: ${error.message || 'Please try again.'}`, 'error')
        if (btn) { btn.disabled = false; btn.innerHTML = originalHTML }
        return
      }

      if (data?.url) {
        console.log(`[OAuth] Redirecting to: ${data.url}`)
        window.location.href = data.url
        return
      }

      if (attempt < 2) continue // retry if no URL returned
      showToast(`Could not get ${provider} sign-in URL. Please try again.`, 'error')
      if (btn) { btn.disabled = false; btn.innerHTML = originalHTML }
      return

    } catch (err) {
      console.error(`[OAuth] Exception on attempt ${attempt}:`, err)
      if (attempt < 2) continue 
      showToast(`Could not connect to ${provider}. Please try again.`, 'error')
      if (btn) { btn.disabled = false; btn.innerHTML = originalHTML }
    }
  }
}

// =============================================
// PROFILE
// =============================================
async function loadProfile() {
  try {
    const { data, error } = await insforge.auth.getProfile(state.currentUser.id)
    if (!error && data) {
      state.currentProfile = data
    } else {
      // create profile row
      await createProfileIfNeeded(state.currentUser.name || state.currentUser.email?.split('@')[0] || 'User')
    }
  } catch {
    await createProfileIfNeeded(state.currentUser.name || state.currentUser.email?.split('@')[0] || 'User')
  }
}

async function createProfileIfNeeded(name) {
  const existing = await insforge.database
    .from('profiles')
    .select('id')
    .eq('id', state.currentUser.id)
    .maybeSingle()

  if (!existing.data) {
    const { data } = await insforge.database
      .from('profiles')
      .insert([{
        id: state.currentUser.id,
        name: name,
        avatar_url: state.currentUser.avatar_url || null,
      }])
      .select()
      .maybeSingle()
    state.currentProfile = data
  } else {
    const { data } = await insforge.database
      .from('profiles')
      .select('*')
      .eq('id', state.currentUser.id)
      .maybeSingle()
    state.currentProfile = data
  }
}

// =============================================
// MAIN APP RENDER
// =============================================
async function renderApp() {
  const app = document.getElementById('app')
  app.innerHTML = `
    <div class="app-container">
      <!-- SIDEBAR -->
      <div class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <div class="user-avatar" id="my-avatar" onclick="handleMyProfile()" title="${escapeHtml(state.currentProfile?.name || 'Me')}">
            ${renderAvatar(state.currentProfile?.name || 'Me', state.currentProfile?.avatar_url, 42)}
          </div>
          <div class="sidebar-actions">
            <button class="icon-btn" title="New chat" onclick="openNewChatModal()">
              ${icons.newChat}
            </button>
            <button class="icon-btn" title="Menu" onclick="openMenu()">
              ${icons.more}
            </button>
          </div>
        </div>

        <div class="sidebar-search">
          <div class="search-box">
            ${icons.search}
            <input class="search-input" id="search-input" type="text" placeholder="Search or start new chat" oninput="handleSearch(this.value)" />
          </div>
        </div>

        <div class="chats-list" id="chats-list">
          <div class="loading-screen" style="height:200px;">
            <div class="spinner"></div>
          </div>
        </div>

        <!-- FAB -->
        <button class="new-chat-btn" onclick="openNewChatModal()" title="New chat">
          ${icons.newChat}
        </button>
      </div>

      <!-- CHAT WINDOW -->
      <div class="chat-window" id="chat-window">
        ${renderWelcomeScreen()}
      </div>
    </div>
  `

  await loadConversations()
  await connectRealtime()
  setupResizeListener()
}

function renderWelcomeScreen() {
  return `
    <div class="welcome-screen">
      <div class="welcome-icon">${icons.chat}</div>
      <h2>Hello App</h2>
      <p>Send and receive messages without keeping your phone online. Use Hello App on up to 4 linked devices and 1 phone at the same time.</p>
      <div class="lock-info">
        ${icons.lock}
        Your messages are secured with Hello App
      </div>
    </div>
  `
}

// =============================================
// AVATAR HELPER
// =============================================
function renderAvatar(name, avatarUrl, size = 50) {
  if (avatarUrl) {
    return `<img src="${escapeHtml(avatarUrl)}" alt="${escapeHtml(name)}" onerror="this.style.display='none'; this.nextSibling.style.display='flex'" /><span style="display:none">${getInitials(name)}</span>`
  }
  const color = stringToColor(name)
  return `<span style="background:${color}; width:100%; height:100%; display:flex; align-items:center; justify-content:center; border-radius:50%; font-size:${Math.round(size * 0.38)}px; font-weight:600; color:white;">${getInitials(name)}</span>`
}

// =============================================
// CONVERSATIONS
// =============================================
async function loadConversations() {
  const { data, error } = await insforge.database
    .from('conversations')
    .select('*, conversation_members!inner(user_id)')
    .eq('conversation_members.user_id', state.currentUser.id)
    .order('last_message_at', { ascending: false })

  if (error) {
    showToast('Failed to load chats', 'error')
    return
  }

  // Enrich with contact names for DMs
  state.conversations = await Promise.all((data || []).map(async (conv) => {
    if (!conv.is_group) {
      // Get other member
      const { data: members } = await insforge.database
        .from('conversation_members')
        .select('user_id')
        .eq('conversation_id', conv.id)

      const otherMemberId = members?.find(m => m.user_id !== state.currentUser.id)?.user_id
      if (otherMemberId) {
        const { data: profile } = await insforge.database
          .from('profiles')
          .select('*')
          .eq('id', otherMemberId)
          .maybeSingle()
        conv._contact = profile
      }
    }
    return conv
  }))

  renderConversationsList(state.conversations)
}

function renderConversationsList(conversations) {
  const list = document.getElementById('chats-list')
  if (!list) return

  if (!conversations.length) {
    list.innerHTML = `
      <div class="empty-chats">
        ${icons.noChats}
        <p>No chats yet</p>
        <p style="font-size:12px; opacity:0.7;">Tap the icon below to start a conversation</p>
      </div>
    `
    return
  }

  list.innerHTML = conversations.map(conv => {
    const name = conv.is_group ? conv.group_name : (conv._contact?.name || 'Unknown')
    const avatar = conv.is_group ? conv.group_avatar_url : conv._contact?.avatar_url
    const preview = conv.last_message || 'No messages yet'
    const time = conv.last_message_at ? formatTime(conv.last_message_at) : ''
    const isActive = state.activeConversation?.id === conv.id

    return `
      <div class="chat-item ${isActive ? 'active' : ''}" onclick="openConversation('${conv.id}')">
        <div class="chat-avatar">
          ${renderAvatar(name, avatar, 50)}
        </div>
        <div class="chat-info">
          <div class="chat-top">
            <span class="chat-name">${escapeHtml(name)}</span>
            <span class="chat-time">${escapeHtml(time)}</span>
          </div>
          <div class="chat-bottom">
            <span class="chat-preview">${escapeHtml(preview)}</span>
          </div>
        </div>
      </div>
    `
  }).join('')
}

// =============================================
// OPEN CONVERSATION / LOAD MESSAGES
// =============================================
window.openConversation = async (convId) => {
  state.activeConversation = state.conversations.find(c => c.id === convId)
  if (!state.activeConversation) return

  // Mobile: show chat window, hide sidebar
  if (state.isMobile) {
    document.getElementById('sidebar')?.classList.add('hidden')
    document.getElementById('chat-window')?.classList.add('visible')
    // Support browser back button on mobile
    window.history.pushState({ conversationOpen: true }, '', `#chat-${convId}`)
  }

  // Highlight active chat
  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'))
  document.querySelector(`.chat-item[onclick="openConversation('${convId}')"]`)?.classList.add('active')

  const conv = state.activeConversation
  const name = conv.is_group ? conv.group_name : (conv._contact?.name || 'Unknown')
  const avatar = conv.is_group ? conv.group_avatar_url : conv._contact?.avatar_url
  const status = conv._contact?.status || (conv.is_group ? `${conv._memberCount || ''} members` : '')

  const chatWindow = document.getElementById('chat-window')
  chatWindow.innerHTML = `
    <div class="chat-header">
      ${state.isMobile ? `<button class="icon-btn" onclick="goBackToSidebar()" style="margin-left:-4px;">${icons.back}</button>` : ''}
      <div class="chat-avatar" style="width:42px;height:42px;font-size:16px;">
        ${renderAvatar(name, avatar, 42)}
      </div>
      <div class="chat-header-info">
        <div class="chat-header-name">${escapeHtml(name)}</div>
        <div class="chat-header-status">${escapeHtml(status)}</div>
      </div>
      <div class="chat-header-actions">
        <button class="icon-btn" title="Search">${icons.search}</button>
        <button class="icon-btn" title="More options">${icons.more}</button>
      </div>
    </div>

    <div class="messages-area" id="messages-area">
      <div class="loading-screen" style="height:200px;">
        <div class="spinner"></div>
      </div>
    </div>

    <div class="input-bar">
      <div class="input-wrapper">
        <button class="emoji-btn" title="Emoji">😊</button>
        <textarea
          class="chat-input"
          id="chat-input"
          placeholder="Type a message"
          rows="1"
          oninput="handleInputChange(this)"
          onkeydown="handleInputKeydown(event)"
        ></textarea>
        <label class="attach-btn" for="file-input" title="Attach image">
          ${icons.attach}
          <input type="file" id="file-input" accept="image/*" style="display:none" onchange="handleFileUpload(event)" />
        </label>
      </div>
      <button class="send-btn" id="send-btn" onclick="sendMessage()" title="Send">
        ${icons.send}
      </button>
    </div>
  `

  await loadMessages(convId)
  await subscribeToConversation(convId)
  document.getElementById('chat-input')?.focus()
}

window.goBackToSidebar = (triggerHistory = true) => {
  document.getElementById('sidebar')?.classList.remove('hidden')
  document.getElementById('chat-window')?.classList.remove('visible')
  state.activeConversation = null
  
  if (triggerHistory && window.location.hash.startsWith('#chat-')) {
    window.history.replaceState(null, '', window.location.pathname)
  }
}

// =============================================
// MESSAGES
// =============================================
async function loadMessages(convId) {
  const { data, error } = await insforge.database
    .from('messages')
    .select('*, profiles(name, avatar_url)')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    showToast('Failed to load messages', 'error')
    return
  }

  state.messages = data || []
  renderMessages()
}

function renderMessages() {
  const area = document.getElementById('messages-area')
  if (!area) return

  if (!state.messages.length) {
    area.innerHTML = `
      <div class="empty-chats" style="height:100%;">
        <p style="font-size:14px;">No messages yet. Say hello! 👋</p>
      </div>
    `
    return
  }

  let html = ''
  let lastDate = null

  state.messages.forEach((msg, i) => {
    const msgDate = formatDate(msg.created_at)
    if (msgDate !== lastDate) {
      html += `<div class="message-day-divider"><span>${escapeHtml(msgDate)}</span></div>`
      lastDate = msgDate
    }

    const isOut = msg.sender_id === state.currentUser.id
    const time = formatTime(msg.created_at)

    html += `
      <div class="message-bubble ${isOut ? 'outgoing' : 'incoming'}">
        ${!isOut && state.activeConversation?.is_group ? `<span style="font-size:12px;font-weight:600;color:var(--wa-green);display:block;margin-bottom:2px;">${escapeHtml(msg.profiles?.name || 'User')}</span>` : ''}
        ${msg.message_type === 'image' && msg.image_url
          ? `<img class="message-image" src="${escapeHtml(msg.image_url)}" alt="Image" onclick="openImageModal('${escapeHtml(msg.image_url)}')" loading="lazy" />`
          : ''
        }
        ${msg.content ? `<span class="message-text">${escapeHtml(msg.content)}</span>` : ''}
        <div class="message-meta">
          <span class="message-time">${escapeHtml(time)}</span>
          ${isOut ? `<span class="message-tick">${icons.tickDouble}</span>` : ''}
        </div>
      </div>
    `
  })

  area.innerHTML = html
  scrollToBottom()
}

function scrollToBottom(smooth = false) {
  const area = document.getElementById('messages-area')
  if (area) area.scrollTo({ top: area.scrollHeight, behavior: smooth ? 'smooth' : 'instant' })
}

function appendMessage(msg) {
  state.messages.push(msg)
  const area = document.getElementById('messages-area')
  if (!area) return

  const isOut = msg.sender_id === state.currentUser.id
  const time = formatTime(msg.created_at)

  const div = document.createElement('div')
  div.className = `message-bubble ${isOut ? 'outgoing' : 'incoming'}`
  div.innerHTML = `
    ${msg.message_type === 'image' && msg.image_url
      ? `<img class="message-image" src="${escapeHtml(msg.image_url)}" alt="Image" onclick="openImageModal('${escapeHtml(msg.image_url)}')" loading="lazy" />`
      : ''
    }
    ${msg.content ? `<span class="message-text">${escapeHtml(msg.content)}</span>` : ''}
    <div class="message-meta">
      <span class="message-time">${escapeHtml(time)}</span>
      ${isOut ? `<span class="message-tick">${icons.tickDouble}</span>` : ''}
    </div>
  `
  area.appendChild(div)
  scrollToBottom(true)
}

// =============================================
// SEND MESSAGE
// =============================================
window.sendMessage = async () => {
  if (!state.activeConversation) return

  const input = document.getElementById('chat-input')
  const content = input?.value.trim()
  if (!content) return

  input.value = ''
  input.style.height = 'auto'

  const tempMsg = {
    id: 'temp-' + Date.now(),
    conversation_id: state.activeConversation.id,
    sender_id: state.currentUser.id,
    content,
    message_type: 'text',
    created_at: new Date().toISOString(),
    profiles: { name: state.currentProfile?.name }
  }
  appendMessage(tempMsg)

  const { data, error } = await insforge.database
    .from('messages')
    .insert([{
      conversation_id: state.activeConversation.id,
      sender_id: state.currentUser.id,
      content,
      message_type: 'text',
    }])
    .select()
    .maybeSingle()

  if (error) {
    showToast('Failed to send message', 'error')
    return
  }

  // Update conversation's last message
  await insforge.database
    .from('conversations')
    .update({ last_message: content, last_message_at: data.created_at })
    .eq('id', state.activeConversation.id)

  // Refresh conversation list
  await loadConversations()
}

window.handleInputChange = (el) => autoResize(el)
window.handleInputKeydown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
}

// =============================================
// IMAGE UPLOAD
// =============================================
window.handleFileUpload = async (e) => {
  const file = e.target.files?.[0]
  if (!file || !state.activeConversation) return

  showToast('Uploading image...', 'default', 5000)

  // Upload to storage
  const { data: uploadData, error: uploadError } = await insforge.storage
    .from('chat-images')
    .uploadAuto(file)

  if (uploadError) {
    showToast('Failed to upload image', 'error')
    return
  }

  const { data, error } = await insforge.database
    .from('messages')
    .insert([{
      conversation_id: state.activeConversation.id,
      sender_id: state.currentUser.id,
      content: null,
      message_type: 'image',
      image_url: uploadData.url,
      image_key: uploadData.key,
    }])
    .select()
    .maybeSingle()

  if (error) {
    showToast('Failed to send image', 'error')
    return
  }

  showToast('Image sent!', 'success')

  await insforge.database
    .from('conversations')
    .update({ last_message: '📷 Photo', last_message_at: data.created_at })
    .eq('id', state.activeConversation.id)

  appendMessage({ ...data, profiles: { name: state.currentProfile?.name } })
  await loadConversations()
  e.target.value = ''
}

// =============================================
// REALTIME
// =============================================
async function connectRealtime() {
  try {
    await insforge.realtime.connect()
    state.realtimeConnected = true

    insforge.realtime.on('connect_error', (err) => {
      state.realtimeConnected = false
    })
    insforge.realtime.on('disconnect', () => {
      state.realtimeConnected = false
    })
  } catch {
    state.realtimeConnected = false
  }
}

async function subscribeToConversation(convId) {
  if (!state.realtimeConnected) return

  try {
    await insforge.realtime.subscribe(`chat:${convId}`)

    insforge.realtime.on('new_message', (payload) => {
      if (!state.activeConversation || state.activeConversation.id !== convId) return
      // Avoid duplicates from our own sends
      if (payload.sender_id === state.currentUser.id) return
      if (state.messages.find(m => m.id === payload.id)) return

      appendMessage({
        ...payload,
        profiles: { name: '' },
      })
    })
  } catch {
    // Realtime subscribe failed — still works without it
  }
}

// =============================================
// NEW CHAT MODAL
// =============================================
window.openNewChatModal = async () => {
  // Load all users from profiles
  const { data } = await insforge.database
    .from('profiles')
    .select('*')
    .neq('id', state.currentUser.id)

  state.allUsers = data || []

  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="new-chat-modal" onclick="closeModalOnOverlay(event, 'new-chat-modal')">
      <div class="modal-card">
        <div class="modal-header">
          <h3>New Chat</h3>
          <button class="icon-btn" onclick="closeModal('new-chat-modal')">${icons.close}</button>
        </div>
        <div class="search-box" style="margin-bottom:8px;">
          ${icons.search}
          <input class="search-input" id="user-search" placeholder="Search users..." oninput="filterUsers(this.value)" />
        </div>
        <div class="users-list" id="users-list">
          ${renderUsersList(state.allUsers)}
        </div>
      </div>
    </div>
  `)
}

function renderUsersList(users) {
  if (!users.length) {
    return `<div style="text-align:center;padding:24px;color:var(--wa-text-secondary);font-size:14px;">No users found</div>`
  }
  return users.map(u => `
    <div class="user-item" onclick="startConversation('${u.id}')">
      <div class="chat-avatar" style="width:44px;height:44px;font-size:17px;border-radius:50%;overflow:hidden;">
        ${renderAvatar(u.name, u.avatar_url, 44)}
      </div>
      <div class="user-item-info">
        <div class="user-item-name">${escapeHtml(u.name)}</div>
        <div class="user-item-status">${escapeHtml(u.status || '')}</div>
      </div>
    </div>
  `).join('')
}

window.filterUsers = (q) => {
  const filtered = q
    ? state.allUsers.filter(u => u.name.toLowerCase().includes(q.toLowerCase()))
    : state.allUsers
  const list = document.getElementById('users-list')
  if (list) list.innerHTML = renderUsersList(filtered)
}

window.startConversation = async (userId) => {
  closeModal('new-chat-modal')

  // Check if DM conversation already exists
  const existing = state.conversations.find(c =>
    !c.is_group && c._contact?.id === userId
  )

  if (existing) {
    openConversation(existing.id)
    return
  }

  // Create new conversation
  const { data: conv, error } = await insforge.database
    .from('conversations')
    .insert([{
      created_by: state.currentUser.id,
      is_group: false,
      last_message_at: new Date().toISOString(),
    }])
    .select()
    .maybeSingle()

  if (error || !conv) {
    showToast('Failed to create conversation', 'error')
    return
  }

  // Add both members
  await insforge.database
    .from('conversation_members')
    .insert([
      { conversation_id: conv.id, user_id: state.currentUser.id },
      { conversation_id: conv.id, user_id: userId },
    ])

  await loadConversations()

  const newConv = state.conversations.find(c => c.id === conv.id)
  if (newConv) openConversation(newConv.id)
}

// =============================================
// SEARCH
// =============================================
window.handleSearch = debounce((query) => {
  const filtered = query
    ? state.conversations.filter(c => {
        const name = c.is_group ? c.group_name : (c._contact?.name || '')
        return name.toLowerCase().includes(query.toLowerCase()) ||
               (c.last_message || '').toLowerCase().includes(query.toLowerCase())
      })
    : state.conversations
  renderConversationsList(filtered)
}, 200)

// =============================================
// IMAGE MODAL
// =============================================
window.openImageModal = (url) => {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="image-modal-overlay" onclick="this.remove()">
      <img src="${escapeHtml(url)}" alt="Full size image" onclick="event.stopPropagation()" />
    </div>
  `)
}

// =============================================
// MODAL HELPERS
// =============================================
window.closeModal = (id) => document.getElementById(id)?.remove()
window.closeModalOnOverlay = (e, id) => {
  if (e.target.id === id) closeModal(id)
}

// =============================================
// PROFILE MENU
// =============================================
window.handleMyProfile = () => {
  showToast(`Signed in as ${state.currentProfile?.name || state.currentUser.email}`)
}

window.openMenu = () => {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="menu-modal" onclick="closeModalOnOverlay(event, 'menu-modal')">
      <div class="modal-card" style="max-width:260px; padding:12px 0;">
        <div style="padding:12px 20px;">
          <div style="font-weight:600;color:var(--wa-text);">${escapeHtml(state.currentProfile?.name || 'User')}</div>
          <div style="font-size:13px;color:var(--wa-text-secondary);">${escapeHtml(state.currentUser?.email || '')}</div>
        </div>
        <div style="border-top:1px solid var(--wa-border);margin:4px 0;"></div>
        <div class="user-item" onclick="handleSignOut()">
          <span style="color:#ff6b6b; font-size:15px;">Sign Out</span>
        </div>
      </div>
    </div>
  `)
}

window.handleSignOut = async () => {
  closeModal('menu-modal')
  await insforge.auth.signOut()
  state.currentUser = null
  state.currentProfile = null
  state.conversations = []
  state.activeConversation = null
  if (state.realtimeConnected) {
    insforge.realtime.disconnect()
    state.realtimeConnected = false
  }
  renderAuth()
}

// =============================================
// RESPONSIVE RESIZE
// =============================================
function setupResizeListener() {
  window.addEventListener('resize', debounce(() => {
    const wasMobile = state.isMobile
    state.isMobile = window.innerWidth <= 768

    if (wasMobile !== state.isMobile) {
      // Reset mobile panels when switching breakpoint
      if (!state.isMobile) {
        document.getElementById('sidebar')?.classList.remove('hidden')
        document.getElementById('chat-window')?.classList.remove('visible')
      } else if (state.activeConversation) {
        document.getElementById('sidebar')?.classList.add('hidden')
        document.getElementById('chat-window')?.classList.add('visible')
      }
    }
  }, 100))

  window.addEventListener('popstate', (e) => {
    if (state.isMobile && state.activeConversation) {
      goBackToSidebar(false)
    }
  })
}

// =============================================
// START
// =============================================
init()
