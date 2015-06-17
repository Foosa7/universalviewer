import BaseCommands = require("./Commands");
import BaseView = require("./BaseView");
import Utils = require("../../Utils");

class FooterPanel extends BaseView {

    $downloadButton: JQuery;
    $embedButton: JQuery;
    $fullScreenBtn: JQuery;
    $options: JQuery;

    constructor($element: JQuery) {
        super($element);
    }

    create(): void {
        this.setConfig('footerPanel');

        super.create();

        $.subscribe(BaseCommands.TOGGLE_FULLSCREEN, () => {
            this.updateFullScreenButton();
        });

        $.subscribe(BaseCommands.SETTINGS_CHANGED, () => {
            this.updateDownloadButton();
        });

        this.$options = $('<div class="options"></div>');
        this.$element.append(this.$options);

        this.$embedButton = $('<a href="#" class="embed" title="' + this.content.embed + '">' + this.content.embed + '</a>');
        this.$options.append(this.$embedButton);
        this.$embedButton.attr('tabindex', '6');

        this.$downloadButton = $('<a class="download" title="' + this.content.download + '">' + this.content.download + '</a>');
        this.$options.prepend(this.$downloadButton);

        this.$fullScreenBtn = $('<a href="#" class="fullScreen" title="' + this.content.fullScreen + '">' + this.content.fullScreen + '</a>');
        this.$options.append(this.$fullScreenBtn);
        this.$fullScreenBtn.attr('tabindex', '5');

        this.$embedButton.onPressed(() => {
            $.publish(BaseCommands.EMBED);
        });

        this.$downloadButton.on('click', (e) => {
            e.preventDefault();

            $.publish(BaseCommands.DOWNLOAD);
        });

        this.$fullScreenBtn.on('click', (e) => {
            e.preventDefault();
            $.publish(BaseCommands.TOGGLE_FULLSCREEN);
        });

        if (!Utils.Bools.getBool(this.options.embedEnabled, true)){
            this.$embedButton.hide();
        }

        this.updateDownloadButton();
        this.updateFullScreenButton();

        if (Utils.Bools.getBool(this.options.minimiseButtons, false)){
            this.$options.addClass('minimiseButtons');
        }
    }

    updateFullScreenButton(): void {
        if (!Utils.Bools.getBool(this.options.fullscreenEnabled, true)){
            this.$fullScreenBtn.hide();
        }

        if (this.provider.isLightbox){
            this.$fullScreenBtn.addClass('lightbox');
        }

        if (this.bootstrapper.isFullScreen) {
            this.$fullScreenBtn.swapClass('fullScreen', 'exitFullscreen');
            this.$fullScreenBtn.text(this.content.exitFullScreen);
            this.$fullScreenBtn.attr('title', this.content.exitFullScreen);
        } else {
            this.$fullScreenBtn.swapClass('exitFullscreen', 'fullScreen');
            this.$fullScreenBtn.text(this.content.fullScreen);
            this.$fullScreenBtn.attr('title', this.content.fullScreen);
        }
    }

    updateDownloadButton() {
        var configEnabled = Utils.Bools.getBool(this.options.downloadEnabled, true);

        if (configEnabled){
            this.$downloadButton.show();
        } else {
            this.$downloadButton.hide();
        }
    }

    resize(): void {
        super.resize();
    }
}

export = FooterPanel;