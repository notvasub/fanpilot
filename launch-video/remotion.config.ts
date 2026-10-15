import { Config } from '@remotion/cli/config';

Config.setVideoImageFormat('jpeg');
Config.setJpegQuality(95);
Config.setConcurrency(8);
Config.setCodec('h264');
Config.setCrf(16);
Config.setPixelFormat('yuv420p');
