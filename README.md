# pink-trombone-vvvv

for the security stuff, run the command in the terminal:
`sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout ./selfsigned.key -out selfsigned.crt`
and put the \*.pem files in a "sec" folder

for auto-playing audio, close all chrome windows and open chrome using this command in the terminal:
`/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --autoplay-policy=no-user-gesture-required`
