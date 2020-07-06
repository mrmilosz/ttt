(function() {
  const start = (listener) => {
    const inputNode = document.querySelector('.input');
    const promptNode = document.querySelector('.output .prompt');
    const completionNode = document.querySelector('.output .completion');
    const errorNode = document.querySelector('.error');
    const goNode = document.querySelector('.go');
    const moreNode = document.querySelector('.more');
    const lengthNode = document.querySelector('.length.display');
    const topPNode = document.querySelector('.top-p.display');
    const temperatureNode = document.querySelector('.temperature.display');
    const lengthSliderNode = document.querySelector('.length-slider');
    const topPSliderNode = document.querySelector('.top-p-slider');
    const temperatureSliderNode = document.querySelector('.temperature-slider');

    const getInput = () => {
      return inputNode.value;
    };

    const beginOutput = (promptText) => {
      promptNode.textContent = promptText;
      completionNode.textContent = '';
      errorNode.textContent = '';
    };

    const getTail = () => {
      const fullText = promptNode.textContent + completionNode.textContent;
      const tailText = fullText.substring(Math.max(fullText.length - 1000, 0));
      return tailText;
    };

    const block = () => {
      inputNode.disabled = true;
      goNode.disabled = true;
      moreNode.classList.remove('visible');
    };

    const appendOutput = (text) => {
      completionNode.textContent += text;
    };

    const appendError = (text) => {
      errorNode.textContent += text;
    };

    const done = (allowContinuation) => {
      inputNode.disabled = false;
      goNode.disabled = false;
      if (allowContinuation && getTail().length > 0) {
        moreNode.classList.add('visible');
      }
    };

    const bindSliderDisplay = (sliderNode, displayNode, conversionFunction) => {
      const displayValue = () => {
        displayNode.textContent = conversionFunction(parseFloat(sliderNode.value));
      }
      displayValue();
      sliderNode.addEventListener('input', displayValue);
    };

    bindSliderDisplay(lengthSliderNode, lengthNode, (value) => (10 * value).toString());
    bindSliderDisplay(topPSliderNode, topPNode, (value) => (value / 100).toFixed(2));
    bindSliderDisplay(temperatureSliderNode, temperatureNode, (value) => Math.pow(10, 5 * value / 100 - 3).toFixed(3).substring(0, 5));

    goNode.addEventListener('click', () => {
      if (!goNode.disabled) {
        const generatorParameters = {
          length: parseInt(lengthNode.textContent),
          topP: parseFloat(topPNode.textContent),
          temperature: parseFloat(temperatureNode.textContent),
          streamResponse: true,
        }
        const text = getInput();
        block();
        beginOutput(text);
        if (text.length > 0) {
          generatorParameters.prompt = {
            text: text,
          };
        }
        listener(generatorParameters, appendOutput, appendError, done);
      }
    });

    moreNode.addEventListener('click', () => {
      if (!goNode.disabled && !moreNode.disabled) {
        const text = getTail();
        block();
        listener({
          prompt: {
            text: text,
            isContinuation: true,
          },
          length: parseInt(lengthNode.textContent),
          topP: parseFloat(topPNode.textContent),
          temperature: parseFloat(temperatureNode.textContent),
          streamResponse: true,
        }, appendOutput, appendError, done);
      }
    });
  };

  document.addEventListener('DOMContentLoaded', start.bind(undefined, (generatorParameters, appendOutput, appendError, done) => {
    const connection = new WebSocket(`wss://${window.location.host}`);

    connection.onopen = () => {
      connection.send(JSON.stringify(generatorParameters));
    };

    connection.onerror = (error) => {
      appendError("Client error");
      done(false);
    };

    connection.onmessage = ({ data: rawMessage }) => {
      const message = JSON.parse(rawMessage);
      if (message.error) {
        appendError(message.error);
        done(false);
      }
      else {
        appendOutput(message.text);
      }
    };

    connection.onclose = () => {
      done(true);
    };
  }));
})();
