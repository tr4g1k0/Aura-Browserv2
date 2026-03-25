/**
 * Ghost Mode Privacy Engine
 * Generates JS injection scripts for enhanced privacy:
 * - WebRTC leak blocking
 * - Canvas fingerprint prevention
 * - Audio context fingerprint blocking
 * - Font list fingerprint blocking
 * - User-Agent spoofing
 * - Geolocation spoofing
 * - UTM parameter stripping
 * - Third-party cookie blocking
 */

import { SpoofLocation, getRandomUserAgent } from '../store/useGhostModeStore';

class GhostModePrivacyEngine {
  private sessionUA: string = getRandomUserAgent();

  rotateUserAgent() {
    this.sessionUA = getRandomUserAgent();
  }

  getPrivacyInjectionScript(options: {
    blockWebRTC: boolean;
    rotateUA: boolean;
    spoofLocation: SpoofLocation | null;
  }): string {
    let script = '(function(){try{';

    // 1. Block WebRTC IP leaks
    if (options.blockWebRTC) {
      script += `
        if(window.RTCPeerConnection){
          window.RTCPeerConnection=function(){return{createDataChannel:function(){},createOffer:function(){return Promise.reject('blocked')},setLocalDescription:function(){},close:function(){},addEventListener:function(){},removeEventListener:function(){}};};
          window.webkitRTCPeerConnection=window.RTCPeerConnection;
          window.mozRTCPeerConnection=window.RTCPeerConnection;
          console.log('[Ghost] WebRTC blocked');
        }
      `;
    }

    // 2. Canvas fingerprint prevention (add noise)
    script += `
      var origToDataURL=HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL=function(type){
        var ctx=this.getContext('2d');
        if(ctx){
          var imgData=ctx.getImageData(0,0,this.width,this.height);
          for(var i=0;i<imgData.data.length;i+=4){
            imgData.data[i]^=1;imgData.data[i+1]^=1;
          }
          ctx.putImageData(imgData,0,0);
        }
        return origToDataURL.apply(this,arguments);
      };
      console.log('[Ghost] Canvas fingerprint noise added');
    `;

    // 3. Audio context fingerprint blocking
    script += `
      if(window.AudioContext||window.webkitAudioContext){
        var OrigAC=window.AudioContext||window.webkitAudioContext;
        var origCreateOsc=OrigAC.prototype.createOscillator;
        OrigAC.prototype.createOscillator=function(){
          var osc=origCreateOsc.call(this);
          var origConnect=osc.connect;
          osc.connect=function(dest){
            if(dest&&dest.constructor&&dest.constructor.name==='AnalyserNode'){
              console.log('[Ghost] Audio fingerprint blocked');
              return osc;
            }
            return origConnect.apply(this,arguments);
          };
          return osc;
        };
      }
    `;

    // 4. Font fingerprint blocking
    script += `
      if(document.fonts&&document.fonts.check){
        document.fonts.check=function(){return true;};
        console.log('[Ghost] Font fingerprinting blocked');
      }
    `;

    // 5. User-Agent spoofing
    if (options.rotateUA) {
      script += `
        Object.defineProperty(navigator,'userAgent',{get:function(){return '${this.sessionUA}';},configurable:true});
        Object.defineProperty(navigator,'platform',{get:function(){return 'Win32';},configurable:true});
        Object.defineProperty(navigator,'vendor',{get:function(){return 'Google Inc.';},configurable:true});
        console.log('[Ghost] UA spoofed');
      `;
    }

    // 6. Geolocation spoofing
    if (options.spoofLocation) {
      // Validate and clamp coordinates to prevent JS injection via crafted values.
      // Parsing as Number rejects non-numeric strings; clamping enforces valid ranges.
      const rawLat = Number(options.spoofLocation.lat);
      const rawLng = Number(options.spoofLocation.lng);
      if (!isNaN(rawLat) && !isNaN(rawLng)) {
        const lat = Math.max(-90, Math.min(90, rawLat));
        const lng = Math.max(-180, Math.min(180, rawLng));
        const safeName = JSON.stringify(options.spoofLocation.name);
        script += `
          navigator.geolocation.getCurrentPosition=function(success){
            success({coords:{latitude:${lat},longitude:${lng},accuracy:10,altitude:null,altitudeAccuracy:null,heading:null,speed:null},timestamp:Date.now()});
          };
          navigator.geolocation.watchPosition=function(success){
            success({coords:{latitude:${lat},longitude:${lng},accuracy:10,altitude:null,altitudeAccuracy:null,heading:null,speed:null},timestamp:Date.now()});
            return 0;
          };
          console.log('[Ghost] Location spoofed to ' + ${safeName});
        `;
      }
    }

    // 7. DNT + GPC headers
    script += `
      Object.defineProperty(navigator,'doNotTrack',{get:function(){return '1';},configurable:true});
      Object.defineProperty(navigator,'globalPrivacyControl',{get:function(){return true;},configurable:true});
    `;

    // 8. Block third-party cookies
    script += `
      try{
        var origCookieDesc=Object.getOwnPropertyDescriptor(Document.prototype,'cookie')||Object.getOwnPropertyDescriptor(HTMLDocument.prototype,'cookie');
        if(origCookieDesc){
          Object.defineProperty(document,'cookie',{
            get:function(){return origCookieDesc.get.call(this);},
            set:function(v){
              if(v.indexOf('SameSite=None')!==-1){console.log('[Ghost] 3rd party cookie blocked');return;}
              origCookieDesc.set.call(this,v.replace(/;\s*expires=[^;]*/gi,''));
            },
            configurable:true
          });
        }
      }catch(e){}
    `;

    // 9. Plugins/hardware info masking
    script += `
      Object.defineProperty(navigator,'hardwareConcurrency',{get:function(){return 4;},configurable:true});
      Object.defineProperty(navigator,'deviceMemory',{get:function(){return 8;},configurable:true});
      Object.defineProperty(navigator,'plugins',{get:function(){return[];},configurable:true});
      Object.defineProperty(navigator,'languages',{get:function(){return['en-US','en'];},configurable:true});
      console.log('[Ghost] Privacy engine active');
    }catch(e){console.log('[Ghost] Error:',e);}})();true;`;
    return script;
  }

  /**
   * Strip UTM and tracking parameters from a URL
   */
  stripTrackingParams(url: string): string {
    try {
      const u = new URL(url);
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'msclkid', 'mc_cid', 'mc_eid', 'ref', 'ref_',
        '_ga', '_gl', 'yclid', 'dclid', 'wbraid', 'gbraid',
      ];
      trackingParams.forEach(p => u.searchParams.delete(p));
      return u.toString();
    } catch {
      return url;
    }
  }
}

export const ghostPrivacyEngine = new GhostModePrivacyEngine();
export default ghostPrivacyEngine;
