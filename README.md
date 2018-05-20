## Kodi support for Homey
Adds Kodi support to your Homey!

Automatic pairing is not supported on Kodi on Android. This is an issue with zeroconf on Kodi on Android. In order to add a Kodi on Android device, use the 'Kodi manual' option.

### How to add Kodi to Homey
#### Automatically
* (Kodi) Make sure you have enabled 'Allow programs on other systems to control Kodi' in Settings / Services activate 
* (Kodi) Make sure you have enabled 'Zero Conf > Annouce services to other systems' on Kodi: Settings / Services / General
* (Kodi) Please reboot Kodi at least once after changing the above settings
* (Browser / Homey app): Navigate to devices. Click 'Add device', select kodi and your kodi device(s) should be detected automatically. If your device does not show up, please try to add it manually.

#### Manually
* (Kodi) Make sure you have enabled 'Allow programs on other systems to control Kodi' in Settings / Services activate 
* (Kodi) Please reboot Kodi at least once after changing the above settings
* (Browser / Homey app): Navigate to devices. Click 'Add device', select 'Kodi Manual' and fill in the details. If you don't know your Kodi device's connection details, please navigate to System / System info. 

### Flow support
*Triggers*
* On movie start (doesn't work with every version of Kodi)
* On movie stop (when a movie ends, including credits)
* On episode start (doesn't work with every version of Kodi)
* On episode stop (when an episode, including credits)
* On playback start (anything starts playing)
* On pause  
* On resume 
* On stop (when you press stop)
* On reboot
* On shutdown
* On hibernate
* On wake
* On Homey reconnects to Homey
* On song start

*Conditions*
* Is playing (something / a movie / music / a tv show)

*Actions*
* Start a movie
* Play / Pause
* Play the latest episode of
* Play music by artist
* Next track 
* Previous track
* Start addon
* Stop
* Reboot Kodi
* Hibernate Kodi
* Shutdown Kodi
* Mute
* Unmute
* Subtitle on
* Subtitle off
* Set party mode on
* Set Volume

Flows are triggered whenever something happens on Kodi, whether this has been triggered by Homey or any other remote control.

### FAQ
#### Q: I am getting the following error when I am trying to add a Kodi device: Error: unexpected server response (200)
*A: Make sure you have configured your HTTP port differently than your TCP port. Homey uses TCP (default port 9090) to connect to Kodi. Homey can't connect if you configure the HTTP port to be the same as the TCP port. This might be a bit confusing because only the HTTP port is configurable through the user interface. I'd recommend leaving the HTTP port to the default value of 8080. Then, when trying to connect from Homey, use 9090 as a port number.*

### Donate
Consider buying me a beer if you like this app :-)

[![Paypal donate][pp-donate-image]][pp-donate-link]

[pp-donate-link]: https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=D7H2GG32VETVW&lc=AU&item_number=homey%2dapps&currency_code=AUD&bn=PP%2dDonationsBF%3abtn_donateCC_LG%2egif%3aNonHosted
[pp-donate-image]: https://www.paypalobjects.com/en_US/i/btn/btn_donateCC_LG.gif
