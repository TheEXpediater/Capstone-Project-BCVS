// app/store.js
import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../features/auth/authSlice";
import userReducer from "../features/users/userSlice";
import studentReducer from "../features/student/studentSlice";
import vcReducer from "../features/draft_vc/vcSlice";
import templateReducer from "../features/template/templateSlice"
import issuanceReducer from '../features/issuance/issuanceSlice'
import accountReducer from '../features/accounts/accountSlice'
import requestsReducer from "../features/request/requestsSlice";
import anchorReducer from "../features/anchor/anchorSlice"
import issueReducer from '../features/issuance/issueSlice'
import paymentReducer from '../features/payments/paymentSlice'
import verifyReducer from "../features/verify/verifySlice";
import mobileAccountReducer from "../features/accounts/mobileAccountSlice";
import {
  persistStore,
  persistReducer,
  FLUSH,
  REHYDRATE,
  PAUSE,
  PERSIST,
  PURGE,
  REGISTER,
} from "redux-persist";

import storage from "redux-persist/lib/storage";

// 🔑 Persist only the slices that must survive refresh
const authPersistConfig = { key: "auth", storage };
const userPersistConfig = { key: "users", storage };

// Wrap reducers individually
const persistedAuthReducer = persistReducer(authPersistConfig, authReducer);
const persistedUserReducer = persistReducer(userPersistConfig, userReducer);

export const store = configureStore({
  reducer: {
    auth: persistedAuthReducer,   
    student: studentReducer,     
    users: persistedUserReducer,  
    template:templateReducer,  
    issuance: issuanceReducer,  
    accounts: accountReducer,   
    requests:requestsReducer,
    anchor: anchorReducer,
    issue: issueReducer,
    payment: paymentReducer,
    verify: verifyReducer,
    mobileAccounts:mobileAccountReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER],
      },
    }),
});

export const persistor = persistStore(store);
