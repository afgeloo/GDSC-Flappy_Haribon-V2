var debugmode = false;

var states = Object.freeze({
  SplashScreen: 0,
  GameScreen: 1,
  ScoreScreen: 2,
});

var currentstate;

var gravity = 0.25;
var velocity = 0;
var position = 180;
var rotation = 0;
var jump = -4.6;
var flyArea = $("#flyarea").height();

var score = 0;
var highscore = 0;

var pipeheight = 90;
var pipewidth = 52;
var pipes = new Array();

var replayclickable = false;
var hasShield = false;
var shieldTimeout = null;
var shieldColorSwitchInterval = null;

//sounds
var volume = 30;
var soundJump = new buzz.sound("assets/sounds/sfx_wing.ogg");
var soundScore = new buzz.sound("assets/sounds/sfx_point.ogg");
var soundHit = new buzz.sound("assets/sounds/sfx_hit.ogg");
var soundDie = new buzz.sound("assets/sounds/sfx_die.ogg");
var soundSwoosh = new buzz.sound("assets/sounds/sfx_swooshing.ogg");
buzz.all().setVolume(volume);

// Look for bird color
randomizeBirdColor();

//loops
var loopGameloop;
var loopPipeloop;

$(document).ready(function () {
  if (window.location.search == "?debug") debugmode = true;
  if (window.location.search == "?easy") pipeheight = 200;

  //get the highscore
  var savedscore = getCookie("highscore");
  if (savedscore != "") highscore = parseInt(savedscore);

  //start with the splash screen
  showSplash();
});

function getCookie(cname) {
  var name = cname + "=";
  var ca = document.cookie.split(";");
  for (var i = 0; i < ca.length; i++) {
    var c = ca[i].trim();
    if (c.indexOf(name) == 0) return c.substring(name.length, c.length);
  }
  return "";
}

function setCookie(cname, cvalue, exdays) {
  var d = new Date();
  d.setTime(d.getTime() + exdays * 24 * 60 * 60 * 1000);
  var expires = "expires=" + d.toGMTString();
  document.cookie = cname + "=" + cvalue + "; " + expires;
}

function showSplash() {
  currentstate = states.SplashScreen;

  //set the defaults (again)
  velocity = 0;
  position = 180;
  rotation = 0;
  score = 0;

  //update the player in preparation for the next game
  $("#player").css({ y: 0, x: 0 });
  updatePlayer($("#player"));

  soundSwoosh.stop();
  soundSwoosh.play();

  //clear out all the pipes if there are any
  $(".pipe").remove();
  pipes = new Array();

  //make everything animated again
  $(".animated").css("animation-play-state", "running");
  $(".animated").css("-webkit-animation-play-state", "running");

  //fade in the splash
  $("#splash").transition({ opacity: 1 }, 2000, "ease");
}

function startGame() {
  currentstate = states.GameScreen;
  startDayNightCycle();

  //fade out the splash
  $("#splash").stop();
  $("#splash").transition({ opacity: 0 }, 500, "ease");

  //update the big score
  setBigScore();

  //debug mode?
  if (debugmode) {
    $(".boundingbox").show();
  }

  // Clear previous power-ups
  $(".powerup").remove();
  powerups = [];

  // start game loops
  var updaterate = 1000.0 / 60.0;
  loopGameloop = setInterval(gameloop, updaterate);
  loopPipeloop = setInterval(updatePipes, 1400);
  loopPowerUp = setInterval(spawnPowerUp, 5000);

  // start flying
  playerJump();
}

function flashPowerUpEffect() {
  const flash = $("#powerup-flash");
  flash.stop(true, true).css({
    opacity: 1,
    display: "block"
  });

  setTimeout(() => {
    flash.fadeOut(150);
  }, 50);
}

var loopDayNight;

function startDayNightCycle() {
  let isNight = false;
  loopDayNight = setInterval(() => {
    isNight = !isNight;
    if (isNight) {
      $("#sky").addClass("night-mode");
    } else {
      $("#sky").removeClass("night-mode");
    }
  }, 10000); // every 10 seconds
}


function updatePlayer(player) {
  //rotation
  rotation = Math.min((velocity / 10) * 90, 90);

  //apply rotation and position
  $(player).css({ rotate: rotation, top: position });
}

function gameloop() {
  var player = $("#player");

  //update the player speed/position
  velocity += gravity;
  position += velocity;

  //update the player
  updatePlayer(player);

  //create the bounding box
  var box = document.getElementById("player").getBoundingClientRect();
  var origwidth = 34.0;
  var origheight = 24.0;

  var boxwidth = origwidth - Math.sin(Math.abs(rotation) / 90) * 8;
  var boxheight = (origheight + box.height) / 2;
  var boxleft = (box.width - boxwidth) / 2 + box.left;
  var boxtop = (box.height - boxheight) / 2 + box.top;
  var boxright = boxleft + boxwidth;
  var boxbottom = boxtop + boxheight;

  //if we're in debug mode, draw the bounding box
  if (debugmode) {
    var boundingbox = $("#playerbox");
    boundingbox.css("left", boxleft);
    boundingbox.css("top", boxtop);
    boundingbox.css("height", boxheight);
    boundingbox.css("width", boxwidth);
  }

  //did we hit the ground?
  if (box.bottom >= $("#land").offset().top) {
    playerDead();
    return;
  }

  //have they tried to escape through the ceiling? :o
  var ceiling = $("#ceiling");
  if (boxtop <= ceiling.offset().top + ceiling.height()) position = 0;

  //we can't go any further without a pipe
  if (pipes[0] == null) return;

  //determine the bounding box of the next pipes inner area
  var nextpipe = pipes[0];
  var nextpipeupper = nextpipe.children(".pipe_upper");

  var pipetop = nextpipeupper.offset().top + nextpipeupper.height();
  var pipeleft = nextpipeupper.offset().left - 2; // for some reason it starts at the inner pipes offset, not the outer pipes.
  var piperight = pipeleft + pipewidth;
  var pipebottom = pipetop + pipeheight;

  if (debugmode) {
    var boundingbox = $("#pipebox");
    boundingbox.css("left", pipeleft);
    boundingbox.css("top", pipetop);
    boundingbox.css("height", pipeheight);
    boundingbox.css("width", pipewidth);
  }

  //have we gotten inside the pipe yet?
  // Pipe collision with shield logic
  if (!hasShield) {
    if (boxright > pipeleft) {
      if (boxtop > pipetop && boxbottom < pipebottom) {
        // safe passage
      } else {
        playerDead();
        return;
      }
    }
  }


  //have we passed the imminent danger?
  if (boxleft > piperight) {
    //yes, remove it
    pipes.splice(0, 1);

    //and score a point
    playerScore();
  }

  // Power-up collision detection
  for (let i = 0; i < powerups.length; i++) {
    let pu = powerups[i];
    let puBox = pu[0].getBoundingClientRect();

    if (
      boxright > puBox.left &&
      boxleft < puBox.right &&
      boxbottom > puBox.top &&
      boxtop < puBox.bottom
    ) {
      // ✨ Differentiate power-up type by class
      if (pu.hasClass("shrinkpowerup")) {
        $("#player").css({
          transform: "scale(0.5)",
          "transform-origin": "center center",
        });

        // restore after 10 seconds
        setTimeout(() => {
          $("#player").css("transform", "");
        }, 10000);

      } else
        if (pu.hasClass("shieldpowerup")) {
          // Pink shield effect
          hasShield = true;
          $("#player").css("filter", "drop-shadow(0 0 10px pink)");

          // start changing bird color every 300ms
          if (shieldColorSwitchInterval) clearInterval(shieldColorSwitchInterval);
          shieldColorSwitchInterval = setInterval(() => {
            randomizeBirdColor();
          }, 100);

          // stop effect after 5 seconds
          if (shieldTimeout) clearTimeout(shieldTimeout);
          shieldTimeout = setTimeout(() => {
            hasShield = false;
            $("#player").css("filter", "");
            clearInterval(shieldColorSwitchInterval);
            shieldColorSwitchInterval = null;
            randomizeBirdColor();
          }, 5000);

          // Flash screen 2 seconds before end
          // Start blinking 2s before shield ends (3s after pickup)
          setTimeout(() => {
            let blinkCount = 0;
            const maxBlinks = 6; // 6 blinks at 333ms = 2 seconds

            const blinkInterval = setInterval(() => {
              flashPowerUpEffect();
              blinkCount++;
              if (blinkCount >= maxBlinks) {
                clearInterval(blinkInterval);
              }
            }, 333); // blink every 333ms
          }, 3000);



        } else {
          // Default power-up (blue or score-based)
          score += 5;
          setBigScore();
        }

      // Common removal & sound logic
      pu.remove(); // remove from DOM
      powerups.splice(i, 1);
      i--;
      soundScore.stop();
      soundScore.play();
    }
  }


}

//Handle space bar
$(document).keydown(function (e) {
  //space bar!
  if (e.keyCode == 32) {
    //in ScoreScreen, hitting space should click the "replay" button. else it's just a regular spacebar hit
    if (currentstate == states.ScoreScreen) $("#replay").click();
    else screenClick();
  }
});

//Handle mouse down OR touch start
if ("ontouchstart" in window) $(document).on("touchstart", screenClick);
else $(document).on("mousedown", screenClick);

function screenClick() {
  if (currentstate == states.GameScreen) {
    playerJump();
  } else if (currentstate == states.SplashScreen) {
    startGame();
  }
}

function playerJump() {
  velocity = jump;
  //play jump sound
  soundJump.stop();
  soundJump.play();
}

function setBigScore(erase) {
  var elemscore = $("#bigscore");
  elemscore.empty();

  if (erase) return;

  var digits = score.toString().split("");
  for (var i = 0; i < digits.length; i++)
    elemscore.append(
      "<img src='assets/font_big_" +
      digits[i] +
      ".png' alt='" +
      digits[i] +
      "'>"
    );
}

function setSmallScore() {
  var elemscore = $("#currentscore");
  elemscore.empty();

  var digits = score.toString().split("");
  for (var i = 0; i < digits.length; i++)
    elemscore.append(
      "<img src='assets/font_small_" +
      digits[i] +
      ".png' alt='" +
      digits[i] +
      "'>"
    );
}

function setHighScore() {
  var elemscore = $("#highscore");
  elemscore.empty();

  var digits = highscore.toString().split("");
  for (var i = 0; i < digits.length; i++)
    elemscore.append(
      "<img src='assets/font_small_" +
      digits[i] +
      ".png' alt='" +
      digits[i] +
      "'>"
    );
}

function setMedal() {
  var elemmedal = $("#medal");
  elemmedal.empty();

  if (score < 10)
    //signal that no medal has been won
    return false;

  if (score >= 10) medal = "bronze";
  if (score >= 20) medal = "silver";
  if (score >= 30) medal = "gold";
  if (score >= 40) medal = "platinum";

  elemmedal.append(
    '<img src="assets/medal_' + medal + '.png" alt="' + medal + '">'
  );

  //signal that a medal has been won
  return true;
}

function playerDead() {
  $(".animated").css("animation-play-state", "paused");
  $(".animated").css("-webkit-animation-play-state", "paused");

  $("#player").css("transform", "");

  var birdBox = document.getElementById("player").getBoundingClientRect();
  var playerbottom = $("#player").position().top + birdBox.height;
  var floor = flyArea;
  var movey = Math.max(0, floor - playerbottom);

  $("#player").transition(
    { y: movey + "px", rotate: 90 },
    1000,
    "easeInOutCubic"
  );

  currentstate = states.ScoreScreen;

  clearInterval(loopGameloop);
  clearInterval(loopPipeloop);
  loopGameloop = null;
  loopPipeloop = null;
  clearInterval(loopPowerUp);
  loopPowerUp = null;


  if (isIncompatible.any()) {
    showScore();
  } else {
    soundHit.play().bindOnce("ended", function () {
      soundDie.play().bindOnce("ended", function () {
        showScore();
      });
    });
  }
  clearInterval(loopDayNight);
  loopDayNight = null;
  $("#sky").removeClass("night-mode"); // Reset to day

}

function showScore() {
  $("#scoreboard").css("display", "block");

  setBigScore(true);

  if (score > highscore) {
    highscore = score;
    setCookie("highscore", highscore, 999);
  }

  setSmallScore();
  setHighScore();
  var wonmedal = setMedal();

  soundSwoosh.stop();
  soundSwoosh.play();

  $("#scoreboard").css({ y: "40px", opacity: 0 });
  $("#replay").css({ y: "40px", opacity: 0 });
  $("#scoreboard").transition(
    { y: "0px", opacity: 1 },
    600,
    "ease",
    function () {
      soundSwoosh.stop();
      soundSwoosh.play();
      $("#replay").transition({ y: "0px", opacity: 1 }, 600, "ease");

      if (wonmedal) {
        $("#medal").css({ scale: 2, opacity: 0 });
        $("#medal").transition({ opacity: 1, scale: 1 }, 1200, "ease");
      }
    }
  );

  replayclickable = true;
}

$("#replay").click(function () {
  if (!replayclickable) return;
  else replayclickable = false;
  soundSwoosh.stop();
  soundSwoosh.play();

  $("#scoreboard").transition(
    { y: "-40px", opacity: 0 },
    1000,
    "ease",
    function () {
      $("#scoreboard").css("display", "none");

      showSplash();

      randomizeBirdColor();
    }
  );
});

function playerScore() {
  score += 1;
  soundScore.stop();
  soundScore.play();
  setBigScore();
}

function updatePipes() {
  $(".pipe")
    .filter(function () {
      return $(this).position().left <= -100;
    })
    .remove();

  var padding = 80;
  var constraint = flyArea - pipeheight - padding * 2;
  var topheight = Math.floor(Math.random() * constraint + padding);
  var bottomheight = flyArea - pipeheight - topheight;
  var newpipe = $(
    '<div class="pipe animated"><div class="pipe_upper" style="height: ' +
    topheight +
    'px;"></div><div class="pipe_lower" style="height: ' +
    bottomheight +
    'px;"></div></div>'
  );
  $("#flyarea").append(newpipe);
  pipes.push(newpipe);
}

var powerups = [];

function spawnPowerUp() {
  if (currentstate !== states.GameScreen) return;

  var powerup = $('<div class="powerup animated"></div>');

  const rand = Math.random();
  if (rand < 0.33) {
    powerup.addClass("shieldpowerup");
  } else if (rand < 0.66) {
    powerup.addClass("scorepowerup");
  } else {
    powerup.addClass("shrinkpowerup"); // yellow power-up
  }

  var top = Math.floor(Math.random() * (flyArea - 60)) + 30;
  powerup.css("top", top + "px");

  $("#flyarea").append(powerup);
  powerups.push(powerup);

  setTimeout(() => {
    powerup.remove();
    const index = powerups.indexOf(powerup);
    if (index !== -1) {
      powerups.splice(index, 1);
    }
  }, 7000);
}


var isIncompatible = {
  Android: function () {
    return navigator.userAgent.match(/Android/i);
  },
  BlackBerry: function () {
    return navigator.userAgent.match(/BlackBerry/i);
  },
  iOS: function () {
    return navigator.userAgent.match(/iPhone|iPad|iPod/i);
  },
  Opera: function () {
    return navigator.userAgent.match(/Opera Mini/i);
  },
  Safari: function () {
    return (
      navigator.userAgent.match(/OS X.*Safari/) &&
      !navigator.userAgent.match(/Chrome/)
    );
  },
  Windows: function () {
    return navigator.userAgent.match(/IEMobile/i);
  },
  any: function () {
    return (
      isIncompatible.Android() ||
      isIncompatible.BlackBerry() ||
      isIncompatible.iOS() ||
      isIncompatible.Opera() ||
      isIncompatible.Safari() ||
      isIncompatible.Windows()
    );
  },
};

function randomizeBirdColor() {
  // get a random bird class
  var birdClasses = [
    "bird animated bird-1",
    "bird animated bird-2",
    "bird animated bird-3",
    "bird animated bird-4",
    "bird animated bird-5",
  ];
  var randomBirdClass =
    birdClasses[Math.floor(Math.random() * birdClasses.length)];

  // apply the random bird class to the player element
  $(player).removeClass().addClass(randomBirdClass);
}
