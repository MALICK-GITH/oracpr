// AI Coach Conversational Interface - Integrated Design
class AICoachConversational {
  constructor() {
    this.conversations = [];
    this.currentSession = null;
    this.isTyping = false;
    this.suggestions = [
      "Quelle est la valeur de ce pari ?",
      "Analyse les risques pour moi",
      "Compare avec d'autres matchs",
      "Explique la confiance IA",
      "Quelles sont les tendances ?"
    ];
    
    this.init();
  }

  init() {
    console.log('🤖 Initializing AI Coach Conversational...');
    this.setupCoachInterface();
    this.loadConversationHistory();
    this.setupEventListeners();
  }

  setupCoachInterface() {
    const coachPanel = document.getElementById('coachPanel');
    if (!coachPanel) return;

    // Replace existing coach content with conversational interface
    const conversationalInterface = document.createElement('div');
    conversationalInterface.className = 'ai-coach-conversational';
    conversationalInterface.innerHTML = `
      <div class="coach-header">
        <div class="coach-avatar">
          <div class="avatar-icon">🤖</div>
          <div class="avatar-status online"></div>
        </div>
        <div class="coach-info">
          <h3>IA Coach</h3>
          <span class="coach-status">En ligne - Prêt à analyser</span>
        </div>
        <div class="coach-actions">
          <button class="action-btn" id="clearChatBtn" title="Effacer la conversation">
            <span>🗑️</span>
          </button>
          <button class="action-btn" id="exportChatBtn" title="Exporter la conversation">
            <span>📤</span>
          </button>
        </div>
      </div>

      <div class="coach-messages" id="coachMessages">
        <div class="message ai-message">
          <div class="message-avatar">🤖</div>
          <div class="message-content">
            <p>👋 Bonjour ! Je suis votre IA Coach spécialisé dans l'analyse des matchs FIFA.</p>
            <p>Je peux vous aider à :</p>
            <ul>
              <li>📊 Analyser les cotes et probabilités</li>
              <li>🎯 Évaluer les risques et opportunités</li>
              <li>📈 Identifier les tendances et patterns</li>
              <li>💡 Donner des recommandations personnalisées</li>
            </ul>
            <p>Posez-moi vos questions sur ce match !</p>
          </div>
          <div class="message-time">${this.getCurrentTime()}</div>
        </div>
      </div>

      <div class="coach-suggestions" id="coachSuggestions">
        <div class="suggestions-header">💡 Questions rapides :</div>
        <div class="suggestions-grid">
          ${this.suggestions.map(suggestion => `
            <button class="suggestion-btn" data-suggestion="${suggestion}">
              ${suggestion}
            </button>
          `).join('')}
        </div>
      </div>

      <div class="coach-input">
        <div class="input-container">
          <textarea 
            id="coachInput" 
            placeholder="Tapez votre question ici..."
            rows="1"
            maxlength="500"
          ></textarea>
          <button class="send-btn" id="sendCoachBtn" type="button">
            <span>📤</span>
          </button>
        </div>
        <div class="input-status">
          <span id="charCount">0/500</span>
          <span id="typingStatus" class="hidden">L'IA écrit...</span>
        </div>
      </div>
    `;

    // Replace existing coach content
    const existingContent = coachPanel.querySelector('#coachContent');
    if (existingContent) {
      existingContent.replaceWith(conversationalInterface);
    }
  }

  setupEventListeners() {
    const input = document.getElementById('coachInput');
    const sendBtn = document.getElementById('sendCoachBtn');
    const clearBtn = document.getElementById('clearChatBtn');
    const exportBtn = document.getElementById('exportChatBtn');

    // Input events
    if (input) {
      input.addEventListener('input', (e) => this.handleInput(e));
      input.addEventListener('keydown', (e) => this.handleKeydown(e));
    }

    // Send button
    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendMessage());
    }

    // Clear chat
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearChat());
    }

    // Export chat
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportChat());
    }

    // Suggestion buttons
    document.querySelectorAll('.suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const suggestion = btn.dataset.suggestion;
        input.value = suggestion;
        this.handleInput({ target: input });
        this.sendMessage();
      });
    });
  }

  handleInput(e) {
    const input = e.target;
    const charCount = document.getElementById('charCount');
    
    // Update character count
    if (charCount) {
      charCount.textContent = `${input.value.length}/500`;
    }

    // Auto-resize textarea
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 120) + 'px';

    // Hide suggestions when typing
    const suggestions = document.getElementById('coachSuggestions');
    if (input.value.length > 0 && suggestions) {
      suggestions.classList.add('hidden');
    } else if (suggestions) {
      suggestions.classList.remove('hidden');
    }
  }

  handleKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  async sendMessage() {
    const input = document.getElementById('coachInput');
    const message = input.value.trim();
    
    if (!message || this.isTyping) return;

    // Add user message
    this.addMessage(message, 'user');
    input.value = '';
    this.handleInput({ target: input });

    // Show typing indicator
    this.showTypingIndicator();

    try {
      // Simulate AI response (replace with real API call)
      const response = await this.generateAIResponse(message);
      this.addMessage(response, 'ai');
    } catch (error) {
      this.addMessage('Désolé, je rencontre des difficultés techniques. Réessayez plus tard.', 'ai', 'error');
    } finally {
      this.hideTypingIndicator();
    }
  }

  addMessage(content, sender, type = 'normal') {
    const messagesContainer = document.getElementById('coachMessages');
    if (!messagesContainer) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message ${type === 'error' ? 'error' : ''}`;
    
    const avatar = sender === 'ai' ? '🤖' : '👤';
    
    messageDiv.innerHTML = `
      <div class="message-avatar">${avatar}</div>
      <div class="message-content">
        ${typeof content === 'string' ? `<p>${content}</p>` : content}
      </div>
      <div class="message-time">${this.getCurrentTime()}</div>
    `;

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Store in conversation history
    this.conversations.push({
      content,
      sender,
      type,
      timestamp: new Date().toISOString()
    });

    this.saveConversationHistory();
  }

  async generateAIResponse(userMessage) {
    // Simulate processing time
    await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

    // Generate contextual responses based on keywords
    const message = userMessage.toLowerCase();
    
    if (message.includes('valeur') || message.includes('value')) {
      return `💎 **Analyse de valeur :**\n\nBasé sur les cotes actuelles et notre modèle IA, ce pari présente une valeur de ${65 + Math.random() * 25}%. La cote recommandée de ${1.8 + Math.random() * 2} est supérieure à la probabilité implicite, ce qui crée une opportunité de valeur.\n\n**Facteurs positifs :**\n• Confiance IA élevée (${75 + Math.random() * 20}%)\n• Historique favorable\n• Tendance de cotes baissière\n\n**Risques :**\n• Volatilité récente des cotes\n• Concurrence limitée`;
    }
    
    if (message.includes('risque') || message.includes('danger')) {
      return `⚠️ **Évaluation des risques :**\n\n**Niveau de risque :** ${['Faible', 'Moyen', 'Élevé'][Math.floor(Math.random() * 3)]}\n\n**Analyse détaillée :**\n• **Probabilité de succès :** ${(60 + Math.random() * 30).toFixed(1)}%\n• **Potentiel de perte :** ${(10 + Math.random() * 40).toFixed(1)}%\n• **Volatilité :** ${(20 + Math.random() * 60).toFixed(1)}%\n\n**Recommandations :**\n• Mise maximale suggérée : ${5 + Math.random() * 10}% de votre capital\n• Stop-loss à ${-15 + Math.random() * 10}%\n• Considérez un paris combiné pour diversifier`;
    }
    
    if (message.includes('compar') || message.includes('autre')) {
      return `📊 **Comparaison avec d'autres matchs :**\n\n**Ce match vs Moyenne de la ligue :**\n• **Cote :** ${(0.8 + Math.random() * 0.4).toFixed(2)}x la moyenne\n• **Confiance :** ${(85 + Math.random() * 15).toFixed(1)}% (vs ${(70 + Math.random() * 20).toFixed(1)}% moyenne)\n• **Valeur :** ${(60 + Math.random() * 30).toFixed(1)}% (vs ${(45 + Math.random() * 25).toFixed(1)}% moyenne)\n\n**Top 3 matchs similaires cette semaine :**\n1. Match A - Valeur : ${(70 + Math.random() * 20).toFixed(1)}%\n2. Match B - Valeur : ${(65 + Math.random() * 25).toFixed(1)}%\n3. Match C - Valeur : ${(60 + Math.random() * 30).toFixed(1)}%\n\n**Ce match se classe :** #${1 + Math.floor(Math.random() * 5)} en termes de valeur potentielle`;
    }
    
    if (message.includes('confiance') || message.includes('ia')) {
      return `🧠 **Explication de la confiance IA :**\n\n**Score de confiance actuel :** ${(75 + Math.random() * 20).toFixed(1)}%\n\n**Composantes de l'analyse :**\n• **Analyse historique :** ${(80 + Math.random() * 15).toFixed(1)}%\n• **Forme actuelle :** ${(70 + Math.random() * 25).toFixed(1)}%\n• **Facteurs externes :** ${(60 + Math.random() * 30).toFixed(1)}%\n• **Modèle statistique :** ${(85 + Math.random() * 10).toFixed(1)}%\n\n**Pourquoi cette confiance ?**\n✅ Les équipes ont des statistiques similaires historiquement\n✅ La forme récente correspond aux prédictions\n✅ Les cotes du marché sont alignées avec notre modèle\n✅ Conditions météo favorables au style de jeu`;
    }
    
    if (message.includes('tendance') || message.includes('trend')) {
      return `📈 **Analyse des tendances :**\n\n**Tendances observées :**\n• **Derniers 5 matchs :** Victoire à domicile ${60 + Math.random() * 30}%\n• **Cotes en baisse :** ${(5 + Math.random() * 10).toFixed(1)}% sur 24h\n• **Volume de paris :** En augmentation de ${(20 + Math.random() * 40).toFixed(1)}%\n\n**Patterns historiques :**\n• Cette configuration mène à une victoire domicile ${(65 + Math.random() * 25).toFixed(1)}% du temps\n• Les cotes baissent habituellement avant le match\n• Forte corrélation avec les performances récentes\n\n**Prédictions basées sur les tendances :**\n🎯 Probabilité ajustée : ${(70 + Math.random() * 20).toFixed(1)}%\n⏰ Moment optimal pour parier : ${(2 + Math.random() * 4).toFixed(1)}h avant le match`;
    }
    
    // Default response
    return `🤖 **Analyse IA en cours...**\n\nBasé sur votre question, voici mon analyse :\n\n**Statistiques clés :**\n• Confiance : ${(75 + Math.random() * 20).toFixed(1)}%\n• Valeur potentielle : ${(60 + Math.random() * 30).toFixed(1)}%\n• Risque évalué : ${['Faible', 'Moyen', 'Élevé'][Math.floor(Math.random() * 3)]}\n\n**Recommandation :**\n${['✅ Pari recommandé avec confiance', '⚠️ Pari avec prudence', '❌ Pari déconseillé'][Math.floor(Math.random() * 3)]}\n\nN'hésitez pas à me poser des questions plus spécifiques sur l'analyse des cotes, les risques ou les stratégies de paris !`;
  }

  showTypingIndicator() {
    this.isTyping = true;
    const typingStatus = document.getElementById('typingStatus');
    const sendBtn = document.getElementById('sendCoachBtn');
    
    if (typingStatus) typingStatus.classList.remove('hidden');
    if (sendBtn) sendBtn.disabled = true;
  }

  hideTypingIndicator() {
    this.isTyping = false;
    const typingStatus = document.getElementById('typingStatus');
    const sendBtn = document.getElementById('sendCoachBtn');
    
    if (typingStatus) typingStatus.classList.add('hidden');
    if (sendBtn) sendBtn.disabled = false;
  }

  clearChat() {
    if (!confirm('Êtes-vous sûr de vouloir effacer toute la conversation ?')) return;
    
    const messagesContainer = document.getElementById('coachMessages');
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div class="message ai-message">
          <div class="message-avatar">🤖</div>
          <div class="message-content">
            <p>Conversation effacée. Je suis prêt à vous aider avec de nouvelles questions !</p>
          </div>
          <div class="message-time">${this.getCurrentTime()}</div>
        </div>
      `;
    }
    
    this.conversations = [];
    this.saveConversationHistory();
  }

  exportChat() {
    if (this.conversations.length === 0) {
      alert('Aucune conversation à exporter');
      return;
    }

    const exportData = {
      date: new Date().toISOString(),
      matchId: this.currentMatchId,
      conversations: this.conversations
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-coach-conversation-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  saveConversationHistory() {
    try {
      localStorage.setItem('ai_coach_conversations', JSON.stringify(this.conversations));
    } catch (error) {
      console.warn('Failed to save conversation history:', error);
    }
  }

  loadConversationHistory() {
    try {
      const saved = localStorage.getItem('ai_coach_conversations');
      if (saved) {
        this.conversations = JSON.parse(saved);
      }
    } catch (error) {
      console.warn('Failed to load conversation history:', error);
    }
  }

  getCurrentTime() {
    return new Date().toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  }

  updateMatchContext(matchData) {
    this.currentMatchId = matchData.id;
    // Could add context-specific welcome message
  }

  destroy() {
    // Cleanup if needed
  }
}

// Initialize when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.aiCoach = new AICoachConversational();
    });
  } else {
    window.aiCoach = new AICoachConversational();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AICoachConversational;
}
