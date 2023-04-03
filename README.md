# pink-trombone-websockets

On macOS: 
for the security stuff, run the command in the terminal:
`sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./key.pem -out cert.pem`
Windows is the same but without `sudo`, if you have openssl installed

put the \*.pem files in the /pink-trombone-websockets/sec/ folder

install https://code.visualstudio.com/ & https://nodejs.org/en/
install npm in terminal: sudo npm install
install yarn in VS Code terminal: yarn install 
start localhost: yarn start
open https://localhost/ in chrome

for auto-playing audio, close all chrome windows and open chrome using this command in the terminal:
`/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --autoplay-policy=no-user-gesture-required`


