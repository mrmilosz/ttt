document.addEventListener('DOMContentLoaded', function() {  
  const ui = new class {
    constructor() {
      this.inputNode = document.querySelector('.input');
      this.promptNode = document.querySelector('.output .prompt');
      this.completionNode = document.querySelector('.output .completion');
      this.errorNode = document.querySelector('.error');
      this.goNode = document.querySelector('.go');
    }

    read() {
      const promptText = this.inputNode.value;
      this.inputNode.disabled = true;
      this.promptNode.textContent = promptText;
      this.completionNode.textContent = '';
      this.errorNode.textContent = '';
      this.goNode.disabled = true;
      return promptText;
    }

    appendOutput(text) {
      this.completionNode.textContent += text;
    }

    appendError(text) {
      this.errorNode.textContent += text;
    }

    done() {
      this.inputNode.disabled = false;
      this.inputNode.value = '';
      this.goNode.disabled = false;
    }

    onGo(listener) {
      this.goNode.addEventListener('click', () => {
        if (!this.goNode.disabled) {
          listener(this.read(), this.appendOutput.bind(this), this.appendError.bind(this), this.done.bind(this));
        }
      });
    }
  }();

  const utf8Decoder = new TextDecoder('utf-8');

  ui.onGo(async (promptText, appendOutput, appendError, done) => {
    console.log('awaiting response');
    const response = await fetch('/generate', {
      method: 'POST',
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        promptText: promptText,
      }),
    });
    const reader = response.body.getReader();

    try {
      console.log('awaiting read');
      let { done, value } = await reader.read();
      while (!done) {
        appendOutput(utf8Decoder.decode(value));
        ({ done, value } = await reader.read());
      }
    }
    catch (error) {
      appendError("Transformer did a fuckie wuckie!");
      throw error;
    }
    done();
  });
});
