window.APP_CONFIG = {
  providers: {
    chatgpt: {
      label: "ChatGPT",
      model: "gpt-4o-mini"
    },
    claude: {
      label: "Claude",
      model: ""
    },
    deepseek: {
      label: "DeepSeek",
      model: "deepseek-chat"
    },
    doubao: {
      label: "Volcengine",
      // Leave empty so the server uses DOUBAO_MODEL from .env / hosting dashboard only.
      model: ""
    }
  }
};
