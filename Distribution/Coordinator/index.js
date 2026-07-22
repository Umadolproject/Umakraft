// Distribution/Coordinator/index.js
// Exports the coordinator object — one named action per slash command.
// The Commands department calls coordinator.<action>(payload).

import { fanGain }              from './actions/fanGain.js';
import { profile }              from './actions/profile.js';
import { leaderboard }          from './actions/leaderboard.js';
import { totalFan }             from './actions/totalFan.js';
import { totalCircleFanGain }   from './actions/totalCircleFanGain.js';
import { circleMaster }         from './actions/circleMaster.js';
import { interCircleLeaderboard } from './actions/interCircleLeaderboard.js';
import { clubGain }             from './actions/clubGain.js';
import { joinDate }             from './actions/joinDate.js';
import { memberList }           from './actions/memberList.js';
import { searchTrainer }        from './actions/searchTrainer.js';
import { storeCard }            from './actions/storeCard.js';
import { keepCard }             from './actions/keepCard.js';
import { setTimezone }          from './actions/setTimezone.js';
import { status }               from './actions/status.js';
import { circleStatus }         from './actions/circleStatus.js';
import { help }                 from './actions/help.js';
import { link }                 from './actions/link.js';
import { unlink }               from './actions/unlink.js';
import { linkList }             from './actions/linkList.js';
import { setFans }              from './actions/setFans.js';
import { adminSync }            from './actions/adminSync.js';
import { adminSetJoinDate }     from './actions/adminSetJoinDate.js';
import { testMilestone }        from './actions/testMilestone.js';
import { timelineSetup }        from './actions/timelineSetup.js';
import { timelinePost }         from './actions/timelinePost.js';
import { adminSyncCards }       from './actions/adminSyncCards.js';
import { warningSettings }      from './actions/warningSettings.js';
import { aiCommand }            from './actions/aiGateway.js';

export const coordinator = {
  fanGain,
  profile,
  leaderboard,
  totalFan,
  totalCircleFanGain,
  circleMaster,
  interCircleLeaderboard,
  clubGain,
  joinDate,
  memberList,
  searchTrainer,
  storeCard,
  keepCard,
  setTimezone,
  status,
  circleStatus,
  help,
  link,
  unlink,
  linkList,
  setFans,
  adminSync,
  adminSetJoinDate,
  testMilestone,
  timelineSetup,
  timelinePost,
  adminSyncCards,
  warningSettings,
  aiCommand,
};
