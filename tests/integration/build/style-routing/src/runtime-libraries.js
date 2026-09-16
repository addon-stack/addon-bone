import {getUrl} from "@addon-core/browser";
import {createElement} from "react";
import {createRoot} from "react-dom/client";
import {Builder} from "adnbn/entry/content/vanilla";
import "fixture-styles";
import "./shared.js";

globalThis.runtimeLibraries = {createElement, createRoot, Builder, getUrl};
