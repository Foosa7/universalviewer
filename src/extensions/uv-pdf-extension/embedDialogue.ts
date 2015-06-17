import Utils = require("../../Utils");
import BaseEmbedDialogue = require("../../modules/uv-dialogues-module/EmbedDialogue");
import IPDFProvider = require("./IPDFProvider");

class EmbedDialogue extends BaseEmbedDialogue {

    constructor($element: JQuery) {
        super($element);
    }

    create(): void {

        this.setConfig('embedDialogue');

        super.create();
    }

    formatCode(): void {

        this.code = (<IPDFProvider>this.provider).getEmbedScript(
            this.currentWidth,
            this.currentHeight,
            this.options.embedTemplate);

        this.$code.val(this.code);
    }

    resize(): void {
        super.resize();

    }
}

export = EmbedDialogue;