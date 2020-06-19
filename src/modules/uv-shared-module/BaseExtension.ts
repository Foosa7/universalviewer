//import { isValidUrl } from "../../Utils";
import { Auth09 } from "./Auth09";
import { Auth1 } from "./Auth1";
import { AuthDialogue } from "../../modules/uv-dialogues-module/AuthDialogue";
import { BaseEvents } from "./BaseEvents";
import { ClickThroughDialogue } from "../../modules/uv-dialogues-module/ClickThroughDialogue";
import { IExtension } from "./IExtension";
import { ILocale } from "../../ILocale";
import { ISharePreview } from "./ISharePreview";
import { IUVComponent } from "../../IUVComponent";
import { IUVData } from "../../IUVData";
import { LoginDialogue } from "../../modules/uv-dialogues-module/LoginDialogue";
import { Metric } from "../../modules/uv-shared-module/Metric";
import { MetricType } from "../../modules/uv-shared-module/MetricType";
import { RestrictedDialogue } from "../../modules/uv-dialogues-module/RestrictedDialogue";
import { Shell } from "./Shell";
import { ExternalResource, Helper, ILabelValuePair } from "@iiif/manifold";
import {
  Annotation,
  AnnotationBody,
  Canvas,
  Collection,
  IExternalResource,
  IExternalResourceData,
  IExternalResourceOptions,
  IExternalImageResourceData,
  IManifestoOptions,
  Manifest,
  Range,
  Thumb
} from "manifesto.js";
import { ViewingHint } from "@iiif/vocabulary";
import * as KeyCodes from "@edsilv/key-codes";
import {
  Bools,
  Dates,
  Documents,
  Objects,
  Storage,
  StorageType,
  Urls,
  Strings
} from "@edsilv/utils";

export class BaseExtension implements IExtension {
  $authDialogue: JQuery;
  $clickThroughDialogue: JQuery;
  $element: JQuery;
  $loginDialogue: JQuery;
  $restrictedDialogue: JQuery;
  authDialogue: AuthDialogue;
  clickThroughDialogue: ClickThroughDialogue;
  component: IUVComponent;
  data: IUVData;
  extensions: any;
  helper: Helper;
  isCreated: boolean = false;
  isLoggedIn: boolean = false;
  lastCanvasIndex: number;
  loginDialogue: LoginDialogue;
  metric: MetricType = MetricType.NONE;
  metrics: Metric[] = [];
  mouseX: number;
  mouseY: number;
  name: string;
  resources: IExternalResourceData[] | null;
  restrictedDialogue: RestrictedDialogue;
  shell: Shell;
  shifted: boolean = false;
  tabbing: boolean = false;

  public create(): void {
    const that = this;

    Auth09.publish = this.component.publish.bind(this.component);
    Auth1.publish = this.component.publish.bind(this.component);

    this.$element = $(this.component.options.target);
    this.$element.data("component", this.component);

    this.fire(BaseEvents.CREATE, {
      data: this.data,
      settings: this.getSettings(),
      preview: this.getSharePreview()
    });

    this._parseMetrics();
    this._initLocales();

    // add/remove classes.
    this.$element.empty();
    this.$element.removeClass();
    this.$element.addClass("uv");
    this.$element.addClass("loading");
    if (this.data.locales) {
      this.$element.addClass(this.data.locales[0].name.toLowerCase());
    }
    this.$element.addClass(this.name);
    this.$element.addClass("browser-" + window.browserDetect.browser);
    this.$element.addClass("browser-version-" + window.browserDetect.version);
    this.$element.prop("tabindex", 0);

    if (this.data.embedded) {
      this.$element.addClass("embedded");
    }

    if (this.isMobile()) {
      this.$element.addClass("mobile");
    }

    // todo: deprecate?
    if (this.data.isLightbox) {
      this.$element.addClass("lightbox");
    }

    if (Documents.supportsFullscreen()) {
      this.$element.addClass("fullscreen-supported");
    }

    if (this.isFullScreen()) {
      this.$element.addClass("fullscreen");
    }

    this.$element.on("mousemove", e => {
      this.mouseX = e.pageX;
      this.mouseY = e.pageY;
    });

    // if this is the first load
    if (!this.data.isReload) {
      const visibilityProp: string | null = Documents.getHiddenProp();

      if (visibilityProp) {
        const event: string =
          visibilityProp.replace(/[H|h]idden/, "") + "visibilitychange";
        document.addEventListener(event, () => {
          // resize after a tab has been shown (fixes safari layout issue)
          if (!Documents.isHidden()) {
            this.resize();
          }
        });
      }

      if (Bools.getBool(this.data.config.options.dropEnabled, true)) {
        this.$element.on("drop", e => {
          e.preventDefault();
          const dropUrl: any = (<any>e.originalEvent).dataTransfer.getData(
            "URL"
          );
          const a: HTMLAnchorElement = Urls.getUrlParts(dropUrl);
          let manifestUri:
            | string
            | null = Urls.getQuerystringParameterFromString(
            "manifest",
            a.search
          );

          if (!manifestUri) {
            // look for collection param
            manifestUri = Urls.getQuerystringParameterFromString(
              "collection",
              a.search
            );
          }
          //var canvasUri = Urls.getQuerystringParameterFromString('canvas', url.search);

          if (manifestUri) {
            this.fire(BaseEvents.DROP, manifestUri);
            const data: IUVData = <IUVData>{};
            data.manifestUri = manifestUri;
            this.reload(data);
          }
        });
      }

      this.$element.on("dragover", e => {
        // allow drop
        e.preventDefault();
      });

      // keyboard events.

      this.$element.on("keyup keydown", (e: any) => {
        this.shifted = e.shiftKey;
        this.tabbing = e.keyCode === KeyCodes.KeyDown.Tab;
      });

      this.$element.on("keydown", (e: any) => {
        let event: string | null = null;
        let preventDefault: boolean = true;

        if (!e.ctrlKey && !e.altKey && !e.shiftKey) {
          if (e.keyCode === KeyCodes.KeyDown.Enter) {
            event = BaseEvents.RETURN;
            preventDefault = false;
          }
          if (e.keyCode === KeyCodes.KeyDown.Escape) event = BaseEvents.ESCAPE;
          if (e.keyCode === KeyCodes.KeyDown.PageUp) event = BaseEvents.PAGE_UP;
          if (e.keyCode === KeyCodes.KeyDown.PageDown)
            event = BaseEvents.PAGE_DOWN;
          if (e.keyCode === KeyCodes.KeyDown.End) event = BaseEvents.END;
          if (e.keyCode === KeyCodes.KeyDown.Home) event = BaseEvents.HOME;
          if (
            e.keyCode === KeyCodes.KeyDown.NumpadPlus ||
            e.keyCode === 171 ||
            e.keyCode === KeyCodes.KeyDown.Equals
          ) {
            event = BaseEvents.PLUS;
            preventDefault = false;
          }
          if (
            e.keyCode === KeyCodes.KeyDown.NumpadMinus ||
            e.keyCode === 173 ||
            e.keyCode === KeyCodes.KeyDown.Dash
          ) {
            event = BaseEvents.MINUS;
            preventDefault = false;
          }

          if (that.useArrowKeysToNavigate()) {
            if (e.keyCode === KeyCodes.KeyDown.LeftArrow)
              event = BaseEvents.LEFT_ARROW;
            if (e.keyCode === KeyCodes.KeyDown.UpArrow)
              event = BaseEvents.UP_ARROW;
            if (e.keyCode === KeyCodes.KeyDown.RightArrow)
              event = BaseEvents.RIGHT_ARROW;
            if (e.keyCode === KeyCodes.KeyDown.DownArrow)
              event = BaseEvents.DOWN_ARROW;
          }
        }

        if (event) {
          if (preventDefault) {
            e.preventDefault();
          }
          this.component.publish(event);
        }
      });
    }

    this.component.subscribe(BaseEvents.EXIT_FULLSCREEN, () => {
      if (this.isOverlayActive()) {
        this.component.publish(BaseEvents.ESCAPE);
      }
      this.component.publish(BaseEvents.ESCAPE);
      this.component.publish(BaseEvents.RESIZE);
    });

    this.$element.append('<a href="/" id="top"></a>');
    this.$element.append(
      '<iframe id="commsFrame" style="display:none"></iframe>'
    );

    //this.$element.append('<div id="debug"><span id="watch">Watch</span><span id="mobile-portrait">Mobile Portrait</span><span id="mobile-landscape">Mobile Landscape</span><span id="desktop">Desktop</span></div>');

    this.component.subscribe(BaseEvents.ACCEPT_TERMS, () => {
      this.fire(BaseEvents.ACCEPT_TERMS);
    });

    this.component.subscribe(BaseEvents.LOGIN_FAILED, () => {
      this.fire(BaseEvents.LOGIN_FAILED);
      this.showMessage(this.data.config.content.authorisationFailedMessage);
    });

    this.component.subscribe(BaseEvents.LOGIN, () => {
      this.isLoggedIn = true;
      this.fire(BaseEvents.LOGIN);
    });

    this.component.subscribe(BaseEvents.LOGOUT, () => {
      this.isLoggedIn = false;
      this.fire(BaseEvents.LOGOUT);
    });

    this.component.subscribe(BaseEvents.BOOKMARK, () => {
      this.bookmark();
      this.fire(BaseEvents.BOOKMARK);
    });

    this.component.subscribe(BaseEvents.CANVAS_INDEX_CHANGE_FAILED, () => {
      this.fire(BaseEvents.CANVAS_INDEX_CHANGE_FAILED);
    });

    this.component.subscribe(
      BaseEvents.CANVAS_INDEX_CHANGED,
      (canvasIndex: number) => {
        this.data.canvasIndex = canvasIndex;
        this.lastCanvasIndex = this.helper.canvasIndex;
        this.helper.canvasIndex = canvasIndex;
        this.fire(BaseEvents.CANVAS_INDEX_CHANGED, this.data.canvasIndex);
      }
    );

    this.component.subscribe(BaseEvents.CLICKTHROUGH, () => {
      this.fire(BaseEvents.CLICKTHROUGH);
    });

    this.component.subscribe(BaseEvents.CLOSE_ACTIVE_DIALOGUE, () => {
      this.fire(BaseEvents.CLOSE_ACTIVE_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.CLOSE_LEFT_PANEL, () => {
      this.fire(BaseEvents.CLOSE_LEFT_PANEL);
      this.resize();
    });

    this.component.subscribe(BaseEvents.CLOSE_RIGHT_PANEL, () => {
      this.fire(BaseEvents.CLOSE_RIGHT_PANEL);
      this.resize();
    });

    this.component.subscribe(
      BaseEvents.COLLECTION_INDEX_CHANGED,
      (collectionIndex: number) => {
        this.data.collectionIndex = collectionIndex;
        this.fire(
          BaseEvents.COLLECTION_INDEX_CHANGED,
          this.data.collectionIndex
        );
      }
    );

    this.component.subscribe(BaseEvents.CREATED, () => {
      this.isCreated = true;
      this.fire(BaseEvents.CREATED);
    });

    this.component.subscribe(BaseEvents.DOWN_ARROW, () => {
      this.fire(BaseEvents.DOWN_ARROW);
    });

    this.component.subscribe(BaseEvents.DOWNLOAD, (obj: any) => {
      this.fire(BaseEvents.DOWNLOAD, obj);
    });

    this.component.subscribe(BaseEvents.END, () => {
      this.fire(BaseEvents.END);
    });

    this.component.subscribe(BaseEvents.ESCAPE, () => {
      this.fire(BaseEvents.ESCAPE);

      if (this.isFullScreen() && !this.isOverlayActive()) {
        this.component.publish(BaseEvents.TOGGLE_FULLSCREEN);
      }
    });

    this.component.subscribe(
      BaseEvents.EXTERNAL_LINK_CLICKED,
      (url: string) => {
        this.fire(BaseEvents.EXTERNAL_LINK_CLICKED, url);
      }
    );

    this.component.subscribe(BaseEvents.OPENED_MEDIA, () => {
      setTimeout(() => {
        this.component.publish(BaseEvents.RESIZE);
        this.fire(BaseEvents.OPENED_MEDIA);
        this.$element.removeClass("loading");
      }, 100); // firefox needs this :-(
    });

    this.component.subscribe(BaseEvents.FEEDBACK, () => {
      this.feedback();
    });

    this.component.subscribe(BaseEvents.FORBIDDEN, () => {
      this.fire(BaseEvents.FORBIDDEN);
      this.component.publish(BaseEvents.OPEN_EXTERNAL_RESOURCE);
    });

    this.component.subscribe(BaseEvents.HIDE_DOWNLOAD_DIALOGUE, () => {
      this.fire(BaseEvents.HIDE_DOWNLOAD_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.HIDE_EMBED_DIALOGUE, () => {
      this.fire(BaseEvents.HIDE_EMBED_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.HIDE_EXTERNALCONTENT_DIALOGUE, () => {
      this.fire(BaseEvents.HIDE_EXTERNALCONTENT_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.HIDE_GENERIC_DIALOGUE, () => {
      this.fire(BaseEvents.HIDE_GENERIC_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.HIDE_HELP_DIALOGUE, () => {
      this.fire(BaseEvents.HIDE_HELP_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.HIDE_INFORMATION, () => {
      this.fire(BaseEvents.HIDE_INFORMATION);
    });

    this.component.subscribe(BaseEvents.HIDE_LOGIN_DIALOGUE, () => {
      this.fire(BaseEvents.HIDE_LOGIN_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.HIDE_OVERLAY, () => {
      this.fire(BaseEvents.HIDE_OVERLAY);
    });

    this.component.subscribe(BaseEvents.HIDE_RESTRICTED_DIALOGUE, () => {
      this.fire(BaseEvents.HIDE_RESTRICTED_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.HIDE_SETTINGS_DIALOGUE, () => {
      this.fire(BaseEvents.HIDE_SETTINGS_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.HOME, () => {
      this.fire(BaseEvents.HOME);
    });

    this.component.subscribe(BaseEvents.LEFT_ARROW, () => {
      this.fire(BaseEvents.LEFT_ARROW);
    });

    this.component.subscribe(BaseEvents.LEFTPANEL_COLLAPSE_FULL_FINISH, () => {
      this.fire(BaseEvents.LEFTPANEL_COLLAPSE_FULL_FINISH);
    });

    this.component.subscribe(BaseEvents.LEFTPANEL_COLLAPSE_FULL_START, () => {
      this.fire(BaseEvents.LEFTPANEL_COLLAPSE_FULL_START);
    });

    this.component.subscribe(BaseEvents.LEFTPANEL_EXPAND_FULL_FINISH, () => {
      this.fire(BaseEvents.LEFTPANEL_EXPAND_FULL_FINISH);
    });

    this.component.subscribe(BaseEvents.LEFTPANEL_EXPAND_FULL_START, () => {
      this.fire(BaseEvents.LEFTPANEL_EXPAND_FULL_START);
    });

    this.component.subscribe(BaseEvents.LOAD_FAILED, () => {
      this.fire(BaseEvents.LOAD_FAILED);

      if (
        !that.lastCanvasIndex == null &&
        that.lastCanvasIndex !== that.helper.canvasIndex
      ) {
        this.component.publish(
          BaseEvents.CANVAS_INDEX_CHANGED,
          that.lastCanvasIndex
        );
      }
    });

    this.component.subscribe(
      BaseEvents.MANIFEST_INDEX_CHANGED,
      (manifestIndex: number) => {
        this.data.manifestIndex = manifestIndex;
        this.fire(BaseEvents.MANIFEST_INDEX_CHANGED, this.data.manifestIndex);
      }
    );

    this.component.subscribe(BaseEvents.NOT_FOUND, () => {
      this.fire(BaseEvents.NOT_FOUND);
    });

    this.component.subscribe(BaseEvents.OPEN, () => {
      this.fire(BaseEvents.OPEN);
      const openUri: string = Strings.format(
        this.data.config.options.openTemplate,
        this.helper.manifestUri
      );
      window.open(openUri);
    });

    this.component.subscribe(BaseEvents.OPEN_LEFT_PANEL, () => {
      this.fire(BaseEvents.OPEN_LEFT_PANEL);
      // todo: use global state
      if (!this.$element.hasClass("loading")) {
        this.resize();
      }
    });

    this.component.subscribe(BaseEvents.OPEN_EXTERNAL_RESOURCE, () => {
      this.fire(BaseEvents.OPEN_EXTERNAL_RESOURCE);
    });

    this.component.subscribe(BaseEvents.OPEN_RIGHT_PANEL, () => {
      this.fire(BaseEvents.OPEN_RIGHT_PANEL);
      // todo: use global state
      if (!this.$element.hasClass("loading")) {
        this.resize();
      }
    });

    this.component.subscribe(BaseEvents.PAGE_DOWN, () => {
      this.fire(BaseEvents.PAGE_DOWN);
    });

    this.component.subscribe(BaseEvents.PAGE_UP, () => {
      this.fire(BaseEvents.PAGE_UP);
    });

    this.component.subscribe(
      BaseEvents.RANGE_CHANGED,
      (range: Range | null) => {
        if (range) {
          this.data.rangeId = range.id;
          this.helper.rangeId = range.id;
          this.fire(BaseEvents.RANGE_CHANGED, this.data.rangeId);
        } else {
          this.data.rangeId = undefined;
          this.helper.rangeId = undefined;
          this.fire(BaseEvents.RANGE_CHANGED, null);
        }
      }
    );

    this.component.subscribe(
      BaseEvents.RESOURCE_DEGRADED,
      (resource: IExternalResource) => {
        this.fire(BaseEvents.RESOURCE_DEGRADED);
        Auth09.handleDegraded(resource);
      }
    );

    this.component.subscribe(BaseEvents.RETURN, () => {
      this.fire(BaseEvents.RETURN);
    });

    this.component.subscribe(BaseEvents.RIGHT_ARROW, () => {
      this.fire(BaseEvents.RIGHT_ARROW);
    });

    this.component.subscribe(BaseEvents.RIGHTPANEL_COLLAPSE_FULL_FINISH, () => {
      this.fire(BaseEvents.RIGHTPANEL_COLLAPSE_FULL_FINISH);
    });

    this.component.subscribe(BaseEvents.RIGHTPANEL_COLLAPSE_FULL_START, () => {
      this.fire(BaseEvents.RIGHTPANEL_COLLAPSE_FULL_START);
    });

    this.component.subscribe(BaseEvents.RIGHTPANEL_EXPAND_FULL_FINISH, () => {
      this.fire(BaseEvents.RIGHTPANEL_EXPAND_FULL_FINISH);
    });

    this.component.subscribe(BaseEvents.RIGHTPANEL_EXPAND_FULL_START, () => {
      this.fire(BaseEvents.RIGHTPANEL_EXPAND_FULL_START);
    });

    this.component.subscribe(
      BaseEvents.SEQUENCE_INDEX_CHANGED,
      (sequenceIndex: number) => {
        this.data.sequenceIndex = sequenceIndex;
        this.fire(BaseEvents.SEQUENCE_INDEX_CHANGED, this.data.sequenceIndex);
      }
    );

    this.component.subscribe(BaseEvents.SETTINGS_CHANGED, (args: any) => {
      this.fire(BaseEvents.SETTINGS_CHANGED, args);
    });

    this.component.subscribe(BaseEvents.SHOW_DOWNLOAD_DIALOGUE, () => {
      this.fire(BaseEvents.SHOW_DOWNLOAD_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.SHOW_EMBED_DIALOGUE, () => {
      this.fire(BaseEvents.SHOW_EMBED_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.SHOW_EXTERNALCONTENT_DIALOGUE, () => {
      this.fire(BaseEvents.SHOW_EXTERNALCONTENT_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.SHOW_GENERIC_DIALOGUE, () => {
      this.fire(BaseEvents.SHOW_GENERIC_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.SHOW_HELP_DIALOGUE, () => {
      this.fire(BaseEvents.SHOW_HELP_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.SHOW_INFORMATION, () => {
      this.fire(BaseEvents.SHOW_INFORMATION);
    });

    this.component.subscribe(BaseEvents.SHOW_LOGIN_DIALOGUE, () => {
      this.fire(BaseEvents.SHOW_LOGIN_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.SHOW_CLICKTHROUGH_DIALOGUE, () => {
      this.fire(BaseEvents.SHOW_CLICKTHROUGH_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.SHOW_MESSAGE, (message: string) => {
      this.showMessage(message);
    });

    this.component.subscribe(BaseEvents.SHOW_RESTRICTED_DIALOGUE, () => {
      this.fire(BaseEvents.SHOW_RESTRICTED_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.SHOW_OVERLAY, () => {
      this.fire(BaseEvents.SHOW_OVERLAY);
    });

    this.component.subscribe(BaseEvents.SHOW_SETTINGS_DIALOGUE, () => {
      this.fire(BaseEvents.SHOW_SETTINGS_DIALOGUE);
    });

    this.component.subscribe(BaseEvents.SHOW_TERMS_OF_USE, () => {
      this.fire(BaseEvents.SHOW_TERMS_OF_USE);

      let terms: string | null = this.helper.getLicense();

      if (!terms) {
        const requiredStatement: ILabelValuePair | null = this.helper.getRequiredStatement();

        if (requiredStatement && requiredStatement.value) {
          terms = requiredStatement.value;
        }
      }

      if (terms) {
        this.showMessage(terms);
      }
    });

    this.component.subscribe(BaseEvents.THUMB_SELECTED, (thumb: Thumb) => {
      this.fire(BaseEvents.THUMB_SELECTED, thumb.index);
    });

    this.component.subscribe(BaseEvents.TOGGLE_FULLSCREEN, () => {
      $("#top").focus();
      this.component.isFullScreen = !this.component.isFullScreen;

      if (this.component.isFullScreen) {
        this.$element.addClass("fullscreen");
      } else {
        this.$element.removeClass("fullscreen");
      }

      this.fire(BaseEvents.TOGGLE_FULLSCREEN, {
        isFullScreen: this.component.isFullScreen,
        overrideFullScreen: this.data.config.options.overrideFullScreen
      });
    });

    this.component.subscribe(BaseEvents.UP_ARROW, () => {
      this.fire(BaseEvents.UP_ARROW);
    });

    this.component.subscribe(BaseEvents.UPDATE_SETTINGS, () => {
      this.fire(BaseEvents.UPDATE_SETTINGS);
    });

    this.component.subscribe(BaseEvents.VIEW_FULL_TERMS, () => {
      this.fire(BaseEvents.VIEW_FULL_TERMS);
    });

    this.component.subscribe(BaseEvents.WINDOW_UNLOAD, () => {
      this.fire(BaseEvents.WINDOW_UNLOAD);
    });

    // create shell and shared views.
    this.shell = new Shell(this.$element);

    this.createModules();
    this.component.publish(BaseEvents.RESIZE); // initial sizing

    setTimeout(() => {
      //this.component.el.classList.add("created");
      this.render();
      this.component.publish(BaseEvents.CREATED);
      this._setDefaultFocus();
    }, 1);
  }

  createModules(): void {
    this.$authDialogue = $(
      '<div class="overlay auth" aria-hidden="true"></div>'
    );
    this.shell.$overlays.append(this.$authDialogue);
    this.authDialogue = new AuthDialogue(this.$authDialogue);

    this.$clickThroughDialogue = $(
      '<div class="overlay clickthrough" aria-hidden="true"></div>'
    );
    this.shell.$overlays.append(this.$clickThroughDialogue);
    this.clickThroughDialogue = new ClickThroughDialogue(
      this.$clickThroughDialogue
    );

    this.$restrictedDialogue = $(
      '<div class="overlay login" aria-hidden="true"></div>'
    );
    this.shell.$overlays.append(this.$restrictedDialogue);
    this.restrictedDialogue = new RestrictedDialogue(this.$restrictedDialogue);

    this.$loginDialogue = $(
      '<div class="overlay login" aria-hidden="true"></div>'
    );
    this.shell.$overlays.append(this.$loginDialogue);
    this.loginDialogue = new LoginDialogue(this.$loginDialogue);
  }

  private _setDefaultFocus(): void {
    setTimeout(() => {
      if (this.data.config.options.allowStealFocus) {
        $("[tabindex=0]").focus();
      }
    }, 1);
  }

  width(): number {
    return this.$element.width();
  }

  height(): number {
    return this.$element.height();
  }

  exitFullScreen(): void {
    this.component.publish(BaseEvents.EXIT_FULLSCREEN);
  }

  fire(name: string, ...args: any[]): void {
    this.component.fire(name, arguments[1]);
  }

  redirect(uri: string): void {
    this.fire(BaseEvents.REDIRECT, uri);
  }

  refresh(): void {
    this.fire(BaseEvents.REFRESH, null);
  }

  render(): void {
    if (
      !this.isCreated ||
      this.data.collectionIndex !== this.helper.collectionIndex
    ) {
      this.component.publish(
        BaseEvents.COLLECTION_INDEX_CHANGED,
        this.data.collectionIndex
      );
    }

    if (
      !this.isCreated ||
      this.data.manifestIndex !== this.helper.manifestIndex
    ) {
      this.component.publish(
        BaseEvents.MANIFEST_INDEX_CHANGED,
        this.data.manifestIndex
      );
    }

    if (
      !this.isCreated ||
      this.data.sequenceIndex !== this.helper.sequenceIndex
    ) {
      this.component.publish(
        BaseEvents.SEQUENCE_INDEX_CHANGED,
        this.data.sequenceIndex
      );
    }

    if (!this.isCreated || this.data.canvasIndex !== this.helper.canvasIndex) {
      this.component.publish(
        BaseEvents.CANVAS_INDEX_CHANGED,
        this.data.canvasIndex
      );
    }

    if (!this.isCreated || this.data.rangeId !== this.helper.rangeId) {
      if (this.data.rangeId) {
        const range: Range | null = this.helper.getRangeById(this.data.rangeId);

        if (range) {
          this.component.publish(BaseEvents.RANGE_CHANGED, range);
        } else {
          console.warn("range id not found:", this.data.rangeId);
        }
      }
    }
  }

  private _initLocales(): void {
    const availableLocales: any[] = this.data.config.localisation.locales.slice(
      0
    );
    const configuredLocales: ILocale[] | undefined = this.data.locales;
    const finalLocales: ILocale[] = [];

    // loop through configuredLocales array (those passed in when initialising the UV component)
    // if availableLocales (those available in each extension's l10n directory) contains a configured locale, add it to finalLocales.
    // if the configured locale has a label, substitute it
    // mark locale as added.
    // if limitLocales is disabled,
    // loop through remaining availableLocales and add to finalLocales.

    if (configuredLocales) {
      configuredLocales.forEach((configuredLocale: ILocale) => {
        const match: any[] = availableLocales.filter((item: any) => {
          return item.name === configuredLocale.name;
        });
        if (match.length) {
          var m: any = match[0];
          if (configuredLocale.label) m.label = configuredLocale.label;
          m.added = true;
          finalLocales.push(m);
        }
      });

      const limitLocales: boolean = Bools.getBool(
        this.data.config.options.limitLocales,
        false
      );

      if (!limitLocales) {
        availableLocales.forEach((availableLocale: any) => {
          if (!availableLocale.added) {
            finalLocales.push(availableLocale);
          }
          delete availableLocale.added;
        });
      }

      this.data.locales = finalLocales;
    } else {
      console.warn("No locales configured");
    }
  }

  private _parseMetrics(): void {
    const metrics: any[] = this.data.config.options.metrics;

    if (metrics) {
      for (let i = 0; i < metrics.length; i++) {
        const m: any = metrics[i];
        if (typeof m.type === "string") {
          m.type = new MetricType(m.type);
        }
        this.metrics.push(m);
      }
    }
  }

  private _updateMetric(): void {
    setTimeout(() => {
      // loop through all metrics
      // find one that matches the current dimensions
      // if a metric is found, and it's not the current metric, set it to be the current metric and publish a METRIC_CHANGED event
      // if no metric is found, set MetricType.NONE to be the current metric and publish a METRIC_CHANGED event

      let metricFound: boolean = false;

      for (let i = 0; i < this.metrics.length; i++) {
        const metric: Metric = this.metrics[i];

        // if the current width and height is within this metric's defined range
        const width: number = window.innerWidth;
        const height: number = window.innerHeight;

        if (
          width >= metric.minWidth &&
          width <= metric.maxWidth &&
          height >= metric.minHeight &&
          height <= metric.maxHeight
        ) {
          metricFound = true;

          if (this.metric !== metric.type) {
            this.metric = metric.type;
            this.component.publish(BaseEvents.METRIC_CHANGED);
          }
        }
      }

      if (!metricFound) {
        if (this.metric !== MetricType.NONE) {
          this.metric = MetricType.NONE;
          this.component.publish(BaseEvents.METRIC_CHANGED);
        }
      }
    }, 1);
  }

  resize(): void {
    this._updateMetric();
    this.component.publish(BaseEvents.RESIZE);
  }

  // re-bootstraps the application with new querystring params
  reload(data?: IUVData): void {
    this.component.publish(BaseEvents.RELOAD, data);
  }

  isSeeAlsoEnabled(): boolean {
    return this.data.config.options.seeAlsoEnabled !== false;
  }

  getShareUrl(): string | null {
    // If not embedded on an external domain (this causes CORS errors when fetching parent url)
    if (!this.data.embedded) {
      // Use the current page URL with hash params
      if (Documents.isInIFrame()) {
        return (<any>parent.document).location.href;
      } else {
        return (<any>document).location.href;
      }
    } else {
      // If there's a `related` property of format `text/html` in the manifest
      if (this.helper.hasRelatedPage()) {
        // Use the `related` property in the URL box
        var related: any = this.helper.getRelated();
        if (related && related.length) {
          related = related[0];
        }
        return related["@id"];
      }
    }

    return null;
  }

  getIIIFShareUrl(shareManifests: boolean = false): string {
    let manifestUri: string | undefined;

    if (shareManifests) {
      if (this.helper.manifest) {
        manifestUri = this.helper.manifest.id;
      } else {
        manifestUri = this.helper.manifestUri;
      }
    }

    return `${manifestUri}?manifest=${manifestUri}`;
  }

  addTimestamp(uri: string): string {
    return uri + "?t=" + Dates.getTimeStamp();
  }

  getDomain(): string {
    const parts: any = Urls.getUrlParts(this.helper.manifestUri);
    return parts.host;
  }

  getAppUri(): string {
    const parts: any = Urls.getUrlParts((<any>document).location.href);
    const origin: string =
      window.location.protocol +
      "//" +
      window.location.hostname +
      (window.location.port ? ":" + window.location.port : "");
    let pathname: string = parts.pathname;

    if (!pathname.startsWith("/")) {
      pathname = "/" + pathname;
    }

    pathname = pathname.substr(0, pathname.lastIndexOf("/") + 1); // remove the file name

    let appUri: string = origin + pathname;
    // let assetsDir: string = '';

    // if (!Documents.isInIFrame()) {

    //     assetsDir = this.data.assetsDir || '';

    //     if (assetsDir.startsWith('./')) {
    //         assetsDir = assetsDir.substr(2);
    //     }

    //     if (assetsDir && !assetsDir.endsWith('/')) {
    //         assetsDir += '/';
    //     }
    // }

    // // if assetsDir is a URL, use that instead of appUri.
    // if (isValidUrl(assetsDir)) {
    //     return assetsDir + 'uv.html';
    // }

    return appUri + "uv.html";
  }

  getSettings(): ISettings {
    if (Bools.getBool(this.data.config.options.saveUserSettings, false)) {
      const settings: any = Storage.get("uv.settings", StorageType.LOCAL);

      if (settings) {
        return $.extend(this.data.config.options, settings.value);
      }
    }

    return this.data.config.options;
  }

  updateSettings(settings: ISettings): void {
    if (Bools.getBool(this.data.config.options.saveUserSettings, false)) {
      const storedSettings: any = Storage.get("uv.settings", StorageType.LOCAL);

      if (storedSettings) {
        settings = $.extend(storedSettings.value, settings);
      }

      // store for ten years
      Storage.set("uv.settings", settings, 315360000, StorageType.LOCAL);
    }

    this.data.config.options = $.extend(this.data.config.options, settings);
  }

  getLocale(): string {
    return this.helper.options.locale as string;
  }

  getSharePreview(): ISharePreview {
    const title: string | null = this.helper.getLabel();

    // todo: use getThumb (when implemented)

    const canvas: Canvas = this.helper.getCurrentCanvas();
    let thumbnail: string = canvas.getProperty("thumbnail");

    if (!thumbnail || !(typeof thumbnail === "string")) {
      thumbnail = canvas.getCanonicalImageUri(
        this.data.config.options.bookmarkThumbWidth
      );
    }

    return <ISharePreview>{
      title: title,
      image: thumbnail
    };
  }

  public getPagedIndices(
    canvasIndex: number = this.helper.canvasIndex
  ): number[] {
    return [canvasIndex];
  }

  public getCurrentCanvases(): Canvas[] {
    const indices: number[] = this.getPagedIndices(this.helper.canvasIndex);
    const canvases: Canvas[] = [];

    for (let i = 0; i < indices.length; i++) {
      const index: number = indices[i];
      const canvas: Canvas = this.helper.getCanvasByIndex(index);
      canvases.push(canvas);
    }

    return canvases;
  }

  public getCanvasLabels(label: string): string {
    const indices: number[] = this.getPagedIndices();
    let labels: string = "";

    if (indices.length === 1) {
      labels = label;
    } else {
      for (let i = 1; i <= indices.length; i++) {
        if (labels.length) labels += ",";
        labels += label + " " + i;
      }
    }

    return labels;
  }

  public getCurrentCanvasRange(): Range | null {
    //var rangePath: string = this.currentRangePath ? this.currentRangePath : '';
    //var range: manifesto.Range = this.helper.getCanvasRange(this.helper.getCurrentCanvas(), rangePath);
    const range: Range | null = this.helper.getCanvasRange(
      this.helper.getCurrentCanvas()
    );
    return range;
  }

  // todo: move to manifold?
  public getExternalResources(
    resources?: IExternalResource[]
  ): Promise<IExternalResourceData[]> {
    const indices: number[] = this.getPagedIndices();
    const resourcesToLoad: IExternalResource[] = [];

    indices.forEach((index: number) => {
      const canvas: Canvas = this.helper.getCanvasByIndex(index);
      let r: IExternalResource;

      if (!canvas.externalResource) {
        r = new ExternalResource(canvas, <IExternalResourceOptions>{
          authApiVersion: this.data.config.options.authAPIVersion
        });
      } else {
        r = canvas.externalResource;
      }

      // reload resources if passed
      if (resources) {
        const found: IExternalResource | undefined = resources.find(
          (f: IExternalResource) => {
            return f.dataUri === r.dataUri;
          }
        );

        if (found) {
          resourcesToLoad.push(found);
        } else {
          resourcesToLoad.push(r);
        }
      } else {
        resourcesToLoad.push(r);
      }
    });

    const storageStrategy: StorageType = this.data.config.options.tokenStorage;
    const authAPIVersion: number = this.data.config.options.authAPIVersion;

    // if using auth api v1
    if (authAPIVersion === 1) {
      return new Promise<IExternalResourceData[]>(resolve => {
        const options: IManifestoOptions = <IManifestoOptions>{
          locale: this.helper.options.locale
        };

        Auth1.loadExternalResources(
          resourcesToLoad,
          storageStrategy,
          options
        ).then((r: IExternalResource[]) => {
          this.resources = r.map((resource: IExternalResource) => {
            return this._prepareResourceData(resource);
          });

          resolve(this.resources);
        });
      });
    } else {
      return new Promise<any[]>(resolve => {
        Auth09.loadExternalResources(resourcesToLoad, storageStrategy).then(
          (r: any[]) => {
            this.resources = r.map((resource: IExternalResource) => {
              return this._prepareResourceData(resource);
            });

            resolve(this.resources);
          }
        );
      });
    }
  }

  // copy useful properties over to the data object to be opened in center panel's openMedia method
  // this is the info.json if there is one, which can be opened natively by openseadragon.
  private _prepareResourceData(resource: IExternalResource): any {
    resource.data.hasServiceDescriptor = resource.hasServiceDescriptor();

    // if the data isn't an info.json, give it the necessary viewing properties
    if (!resource.hasServiceDescriptor()) {
      resource.data.id = <string>resource.dataUri;
      (<IExternalImageResourceData>resource.data).width = resource.width;
      (<IExternalImageResourceData>resource.data).height = resource.height;
    }

    resource.data.index = resource.index;

    return Objects.toPlainObject(resource.data);
  }

  getMediaFormats(canvas: Canvas): AnnotationBody[] {
    const annotations: Annotation[] = canvas.getContent();

    if (annotations && annotations.length) {
      const annotation: Annotation = annotations[0];
      return annotation.getBody();
    } else {
      // legacy IxIF compatibility
      const body: AnnotationBody = <any>{
        id: canvas.id,
        type: canvas.getType(),
        getFormat: function() {
          return "";
        }
      };

      return [body];
    }
  }

  viewCanvas(canvasIndex: number): void {
    if (this.helper.isCanvasIndexOutOfRange(canvasIndex)) {
      this.showMessage(this.data.config.content.canvasIndexOutOfRange);
      return;
    }

    this.component.publish(BaseEvents.OPEN_EXTERNAL_RESOURCE);
  }

  showMessage(
    message: string,
    acceptCallback?: Function,
    buttonText?: string,
    allowClose?: boolean
  ): void {
    this.closeActiveDialogue();

    this.component.publish(BaseEvents.SHOW_GENERIC_DIALOGUE, {
      message: message,
      acceptCallback: acceptCallback,
      buttonText: buttonText,
      allowClose: allowClose
    });
  }

  closeActiveDialogue(): void {
    this.component.publish(BaseEvents.CLOSE_ACTIVE_DIALOGUE);
  }

  isOverlayActive(): boolean {
    return this.shell.$overlays.is(":visible");
  }

  isDesktopMetric(): boolean {
    return this.metric.toString() === MetricType.DESKTOP.toString();
  }

  isWatchMetric(): boolean {
    return this.metric.toString() === MetricType.WATCH.toString();
  }

  isCatchAllMetric(): boolean {
    return this.metric.toString() === MetricType.NONE.toString();
  }

  // todo: use redux in manifold to get reset state
  viewManifest(manifest: Manifest): void {
    const data: IUVData = <IUVData>{};
    data.manifestUri = this.helper.manifestUri;
    data.collectionIndex = <number>this.helper.getCollectionIndex(manifest);
    data.manifestIndex = <number>manifest.index;
    data.sequenceIndex = 0;
    data.canvasIndex = 0;

    this.reload(data);
  }

  // todo: use redux in manifold to get reset state
  viewCollection(collection: Collection): void {
    const data: IUVData = <IUVData>{};
    //data.manifestUri = this.helper.manifestUri;
    data.manifestUri = collection.parentCollection
      ? collection.parentCollection.id
      : this.helper.manifestUri;
    data.collectionIndex = collection.index;
    data.manifestIndex = 0;
    data.sequenceIndex = 0;
    data.canvasIndex = 0;

    this.reload(data);
  }

  isFullScreen(): boolean {
    return this.component.isFullScreen;
  }

  isHeaderPanelEnabled(): boolean {
    return Bools.getBool(this.data.config.options.headerPanelEnabled, true);
  }

  isLeftPanelEnabled(): boolean {
    if (Bools.getBool(this.data.config.options.leftPanelEnabled, true)) {
      if (this.helper.hasParentCollection()) {
        return true;
      } else if (this.helper.isMultiCanvas()) {
        const viewingHint: ViewingHint | null = this.helper.getViewingHint();

        if (
          !viewingHint ||
          (viewingHint && viewingHint !== ViewingHint.CONTINUOUS)
        ) {
          return true;
        }
      }
    }

    return false;
  }

  isRightPanelEnabled(): boolean {
    return Bools.getBool(this.data.config.options.rightPanelEnabled, true);
  }

  isFooterPanelEnabled(): boolean {
    return Bools.getBool(this.data.config.options.footerPanelEnabled, true);
  }

  isMobile(): boolean {
    return $.browser.mobile;
  }

  useArrowKeysToNavigate(): boolean {
    return Bools.getBool(this.data.config.options.useArrowKeysToNavigate, true);
  }

  bookmark(): void {
    // override for each extension
  }

  feedback(): void {
    this.fire(BaseEvents.FEEDBACK, this.data);
  }

  getAlternateLocale(): ILocale | null {
    let alternateLocale: ILocale | null = null;

    if (this.data.locales && this.data.locales.length > 1) {
      alternateLocale = this.data.locales[1];
    }

    return alternateLocale;
  }

  getSerializedLocales(): string | null {
    if (this.data.locales) {
      return this.serializeLocales(this.data.locales);
    }

    return null;
  }

  serializeLocales(locales: ILocale[]): string {
    let serializedLocales: string = "";

    for (let i = 0; i < locales.length; i++) {
      const l = locales[i];
      if (i > 0) serializedLocales += ",";
      serializedLocales += l.name;
      if (l.label) {
        serializedLocales += ":" + l.label;
      }
    }

    return serializedLocales;
  }

  changeLocale(locale: string): void {
    // re-order locales so the passed locale is first

    const data: IUVData = <IUVData>{};

    if (this.data.locales) {
      data.locales = this.data.locales.slice(0);

      const fromIndex: number = data.locales.findIndex((l: any) => {
        return l.name === locale;
      });

      const toIndex: number = 0;
      data.locales.splice(toIndex, 0, data.locales.splice(fromIndex, 1)[0]);

      this.reload(data);
    }
  }
}
