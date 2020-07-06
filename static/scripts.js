document.addEventListener('DOMContentLoaded', function() {  
  const ui = new class {
    constructor() {
      this.inputNode = document.querySelector('.input');
      this.promptNode = document.querySelector('.output .prompt');
      this.completionNode = document.querySelector('.output .completion');
      this.errorNode = document.querySelector('.error');
      this.goNode = document.querySelector('.go');
      this.moreNode = document.querySelector('.more');
    }

    read() {
      const promptText = this.inputNode.value;
      this.promptNode.textContent = promptText;
      this.completionNode.textContent = '';
      this.block();
      return promptText;
    }

    getTail() {
      const fullText = this.promptNode.textContent + this.completionNode.textContent;
      const tailText = fullText.substring(Math.max(fullText.length - 1000, 0));
      this.block();
      return tailText;
    }

    block() {
      this.inputNode.disabled = true;
      this.goNode.disabled = true;
      this.moreNode.classList.remove('visible');
      this.errorNode.textContent = '';
    }

    appendOutput(text) {
      this.completionNode.textContent += text;
    }

    appendError(text) {
      this.errorNode.textContent += text;
    }

    done() {
      this.inputNode.disabled = false;
      this.goNode.disabled = false;
      this.moreNode.classList.add('visible');
    }

    onSubmit(listener) {
      this.goNode.addEventListener('click', () => {
        if (!this.goNode.disabled) {
          listener({
            prompt: {
              text: this.read(),
            },
          }, this.appendOutput.bind(this), this.appendError.bind(this), this.done.bind(this));
        }
      });
      this.moreNode.addEventListener('click', () => {
        if (!this.goNode.disabled) {
          listener({
            prompt: {
              text: this.getTail(),
              isContinuation: true,
            },
          }, this.appendOutput.bind(this), this.appendError.bind(this), this.done.bind(this));
        }
      });
    }
  }();

  const utf8Decoder = new TextDecoder('utf-8');

  ui.onSubmit((message, appendOutput, appendError, done) => {
    const connection = new WebSocket(`wss://${window.location.host}`);

    connection.onopen = () => {
      connection.send(JSON.stringify(message));
    };

    connection.onerror = (error) => {
      appendError(error);
    };

    connection.onmessage = (message) => {
      appendOutput(message.data);
    };

    connection.onclose = () => {
      done();
    };
  });

  
});
