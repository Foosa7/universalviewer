import BaseCommands = require("../uv-shared-module/Commands");
import BaseProvider = require("../uv-shared-module/BaseProvider");
import Commands = require("../../extensions/uv-mediaelement-extension/Commands");
import CenterPanel = require("../uv-shared-module/CenterPanel");
import IMediaElementProvider = require("../../extensions/uv-mediaelement-extension/IMediaElementProvider");
import Utils = require("../../Utils");

class MediaElementCenterPanel extends CenterPanel {

    $container: JQuery;
    media: any;
    mediaHeight: number;
    mediaWidth: number;
    player: any;
    title: string;

    constructor($element: JQuery) {
        super($element);
    }

    create(): void {

        this.setConfig('mediaelementCenterPanel');

        super.create();

        var that = this;

        // events.

        // only full screen video
        if (this.provider.getCanvasType(this.provider.getCanvasByIndex(0)).contains('video')){
            $.subscribe(BaseCommands.TOGGLE_FULLSCREEN, (e) => {
                if (that.bootstrapper.isFullScreen) {
                    that.$container.css('backgroundColor', '#000');
                    that.player.enterFullScreen(false);
                } else {
                    that.$container.css('backgroundColor', 'transparent');
                    that.player.exitFullScreen(false);
                }
            });
        }

        $.subscribe(BaseCommands.OPEN_MEDIA, (e, canvas) => {
            that.viewMedia(canvas);
        });

        this.$container = $('<div class="container"></div>');
        this.$content.append(this.$container);

        this.title = this.extension.provider.getTitle();

    }

    viewMedia(canvas) {

        var that = this;

        this.$container.empty();

        this.mediaHeight = 576;
        this.mediaWidth = 720;

        this.$container.height(this.mediaHeight);
        this.$container.width(this.mediaWidth);

        var id = Utils.Dates.getTimeStamp();
        var poster = (<IMediaElementProvider>this.provider).getPosterImageUri();
        var canvasType: string = this.provider.getCanvasType(this.provider.getCanvasByIndex(0));

        var sources = [];

        _.each(canvas.media, (annotation: any) => {
            var resource = annotation.resource;
            sources.push({
                type: resource.format.substr(resource.format.indexOf(':') + 1),
                src: resource['@id']
            });
        });

        if (canvasType.contains('video')){

            //if (!canvas.sources){
            //    this.media = this.$container.append('<video id="' + id + '" type="video/mp4" src="' + canvas.mediaUri + '" class="mejs-uv" controls="controls" preload="none" poster="' + poster + '"></video>');
            //} else {
                this.media = this.$container.append('<video id="' + id + '" type="video/mp4" class="mejs-uv" controls="controls" preload="none" poster="' + poster + '"></video>');
            //}

            this.player = new MediaElementPlayer("#" + id, {
                type: ['video/mp4', 'video/webm', 'video/flv'],
                plugins: ['flash'],
                alwaysShowControls: false,
                autosizeProgress: false,
                success: function (media) {
                    media.addEventListener('canplay', (e) => {
                        that.resize();
                    });

                    media.addEventListener('play', (e) => {
                        $.publish(Commands.MEDIA_PLAYED, [Math.floor(that.player.media.currentTime)]);
                    });

                    media.addEventListener('pause', (e) => {
                        // mediaelement creates a pause event before the ended event. ignore this.
                        if (Math.floor(that.player.media.currentTime) != Math.floor(that.player.media.duration)) {
                            $.publish(Commands.MEDIA_PAUSED, [Math.floor(that.player.media.currentTime)]);
                        }
                    });

                    media.addEventListener('ended', (e) => {
                        $.publish(Commands.MEDIA_ENDED, [Math.floor(that.player.media.duration)]);
                    });

                    media.setSrc(sources);

                    try {
                        media.load();
                    } catch (e) {
                        // do nothing
                    }
                }
            });
        } else if (canvasType.contains('audio')){

            this.media = this.$container.append('<audio id="' + id + '" type="audio/mp3" src="' + sources[0].src + '" class="mejs-uv" controls="controls" preload="none" poster="' + poster + '"></audio>');

            this.player = new MediaElementPlayer("#" + id, {
                plugins: ['flash'],
                alwaysShowControls: false,
                autosizeProgress: false,
                defaultVideoWidth: that.mediaWidth,
                defaultVideoHeight: that.mediaHeight,
                success: function (media) {
                    media.addEventListener('canplay', (e) => {
                        that.resize();
                    });

                    media.addEventListener('play', (e) => {
                        $.publish(Commands.MEDIA_PLAYED, [Math.floor(that.player.media.currentTime)]);
                    });

                    media.addEventListener('pause', (e) => {
                        // mediaelement creates a pause event before the ended event. ignore this.
                        if (Math.floor(that.player.media.currentTime) != Math.floor(that.player.media.duration)) {
                            $.publish(Commands.MEDIA_PAUSED, [Math.floor(that.player.media.currentTime)]);
                        }
                    });

                    media.addEventListener('ended', (e) => {
                        $.publish(Commands.MEDIA_ENDED, [Math.floor(that.player.media.duration)]);
                    });

                    //media.setSrc(sources);

                    try {
                        media.load();
                    } catch (e) {
                        // do nothing
                    }
                }
            });
        }

        this.resize();
    }

    resize() {

        super.resize();

        // if in Firefox < v13 don't resize the media container.
        if (window.browserDetect.browser === 'Firefox' && window.browserDetect.version < 13) {
            this.$container.width(this.mediaWidth);
            this.$container.height(this.mediaHeight);
        } else {
            // fit media to available space.
            var size: Utils.Size = Utils.Measurement.fitRect(this.mediaWidth, this.mediaHeight, this.$content.width(), this.$content.height());

            this.$container.height(size.height);
            this.$container.width(size.width);
        }

        if (this.player && !this.extension.isFullScreen){
            this.player.resize();
        }

        var left = Math.floor((this.$content.width() - this.$container.width()) / 2);
        var top = Math.floor((this.$content.height() - this.$container.height()) / 2);

        this.$container.css({
            'left': left,
            'top': top
        });

        this.$title.ellipsisFill(this.title);
    }
}

export = MediaElementCenterPanel;